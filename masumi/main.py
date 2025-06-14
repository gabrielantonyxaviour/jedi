import os
import uvicorn
import uuid
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from masumi.config import Config
from masumi.payment import Payment, Amount
from logging_config import setup_logging

# Configure logging
logger = setup_logging()

# Load environment variables
load_dotenv(override=True)

# Retrieve API Keys and URLs
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL")
PAYMENT_API_KEY = os.getenv("PAYMENT_API_KEY")
NETWORK = os.getenv("NETWORK")
EXPRESS_SERVER_URL = os.getenv("EXPRESS_SERVER_URL", "http://localhost:3000")

logger.info("Starting Jedi payment middleware with configuration:")
logger.info(f"PAYMENT_SERVICE_URL: {PAYMENT_SERVICE_URL}")
logger.info(f"EXPRESS_SERVER_URL: {EXPRESS_SERVER_URL}")

# Initialize FastAPI
app = FastAPI(
    title="Jedi Payment Middleware",
    description="Payment middleware for Jedi project management system",
    version="1.0.0"
)

# ─────────────────────────────────────────────────────────────────────────────
# Temporary in-memory job store (DO NOT USE IN PRODUCTION)
# ─────────────────────────────────────────────────────────────────────────────
jobs = {}
payment_instances = {}
project_payments = {}  # Track which projects have been paid for

# ─────────────────────────────────────────────────────────────────────────────
# Initialize Masumi Payment Config
# ─────────────────────────────────────────────────────────────────────────────
config = Config(
    payment_service_url=PAYMENT_SERVICE_URL,
    payment_api_key=PAYMENT_API_KEY
)

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────
class CreateProjectRequest(BaseModel):
    identifier_from_purchaser: str
    repoUrl: str
    walletAddress: str
    side: str = "light"

class SetupInfoRequest(BaseModel):
    projectId: str
    name: str
    description: str
    technicalDescription: str
    imageUrl: str

class SetupSocialsRequest(BaseModel):
    projectId: str
    twitter: str = None
    linkedin: str = None
    telegram: str = None
    autoPost: bool = False
    character: dict = None
    postsPerDay: str = "3"

class SetupKarmaRequest(BaseModel):
    projectId: str
    title: str
    description: str
    imageURL: str
    ownerAddress: str
    ownerPkey: str
    members: list = []
    membersPKey: str = None
    userEmail: str
    userName: str

class SetupIPRequest(BaseModel):
    projectId: str
    title: str
    description: str
    imageURL: str
    remixFee: str
    commercialRevShare: str

class InteractRequest(BaseModel):
    identifier_from_purchaser: str
    projectId: str
    prompt: str

class AnalyzeRequest(BaseModel):
    identifier_from_purchaser: str
    repoUrl: str
    userId: str = "anonymous"
    projectKey: str

# ─────────────────────────────────────────────────────────────────────────────
# Express Server Communication
# ─────────────────────────────────────────────────────────────────────────────
async def call_express_api(endpoint: str, method: str = "POST", data: dict = None):
    """Make API calls to the Express server"""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{EXPRESS_SERVER_URL}{endpoint}"
            
            if method == "POST":
                response = await client.post(url, json=data, timeout=30.0)
            elif method == "GET":
                response = await client.get(url, timeout=30.0)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        logger.error(f"Timeout calling Express API: {endpoint}")
        raise HTTPException(status_code=504, detail="Express server timeout")
    except httpx.HTTPStatusError as e:
        logger.error(f"Express API error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Express server error: {e.response.text}")
    except Exception as e:
        logger.error(f"Error calling Express API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Express server: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# Payment Processing
# ─────────────────────────────────────────────────────────────────────────────
async def process_payment_and_execute(job_id: str, payment_id: str, action: str, payload: dict) -> None:
    """Process payment and execute the corresponding Express API call"""
    try:
        logger.info(f"Payment {payment_id} completed for job {job_id}, executing {action}...")
        
        # Update job status to running
        jobs[job_id]["status"] = "running"

        # Execute the Express API call
        result = await call_express_api(payload["endpoint"], payload.get("method", "POST"), payload.get("data"))
        
        logger.info(f"Express API call completed for job {job_id}")
        
        # Mark payment as completed on Masumi
        await payment_instances[job_id].complete_payment(payment_id, result)
        logger.info(f"Payment completed for job {job_id}")

        # Update job status
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["payment_status"] = "completed"
        jobs[job_id]["result"] = result

        # Track project payment for subsequent free operations
        if action == "create_project":
            project_id = payload["data"]["projectId"] if "projectId" in payload["data"] else payload["data"].get("repoUrl", "").split("/")[-1]
            project_payments[project_id] = True
            logger.info(f"Project {project_id} marked as paid")

        # Stop monitoring payment status
        if job_id in payment_instances:
            payment_instances[job_id].stop_status_monitoring()
            del payment_instances[job_id]
            
    except Exception as e:
        logger.error(f"Error processing payment {payment_id} for job {job_id}: {str(e)}", exc_info=True)
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        
        # Still stop monitoring to prevent repeated failures
        if job_id in payment_instances:
            payment_instances[job_id].stop_status_monitoring()
            del payment_instances[job_id]

async def create_payment_job(identifier_from_purchaser: str, amount: str, action: str, payload: dict):
    """Create a payment job and return payment details"""
    job_id = str(uuid.uuid4())
    agent_identifier = os.getenv("AGENT_IDENTIFIER")
    
    logger.info(f"Creating payment job {job_id} for action: {action}")

    # Define payment amounts
    amounts = [Amount(amount=amount, unit="lovelace")]
    logger.info(f"Using payment amount: {amount} lovelace")
    
    # Create a payment request using Masumi
    payment = Payment(
        agent_identifier=agent_identifier,
        amounts=amounts,
        config=config,
        identifier_from_purchaser=identifier_from_purchaser,
        input_data={"action": action, "payload": payload},
        network=NETWORK
    )
    
    logger.info("Creating payment request...")
    payment_request = await payment.create_payment_request()
    payment_id = payment_request["data"]["blockchainIdentifier"]
    payment.payment_ids.add(payment_id)
    logger.info(f"Created payment request with ID: {payment_id}")

    # Store job info (Awaiting payment)
    jobs[job_id] = {
        "status": "awaiting_payment",
        "payment_status": "pending",
        "payment_id": payment_id,
        "action": action,
        "payload": payload,
        "result": None,
        "identifier_from_purchaser": identifier_from_purchaser
    }

    async def payment_callback(payment_id: str):
        await process_payment_and_execute(job_id, payment_id, action, payload)

    # Start monitoring the payment status
    payment_instances[job_id] = payment
    logger.info(f"Starting payment status monitoring for job {job_id}")
    await payment.start_status_monitoring(payment_callback)

    # Return the response in the required format
    return {
        "status": "success",
        "job_id": job_id,
        "blockchainIdentifier": payment_request["data"]["blockchainIdentifier"],
        "submitResultTime": payment_request["data"]["submitResultTime"],
        "unlockTime": payment_request["data"]["unlockTime"],
        "externalDisputeUnlockTime": payment_request["data"]["externalDisputeUnlockTime"],
        "agentIdentifier": agent_identifier,
        "sellerVkey": os.getenv("SELLER_VKEY"),
        "identifierFromPurchaser": identifier_from_purchaser,
        "amounts": amounts,
        "input_hash": payment.input_hash
    }

# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

# 1) Create Project (5 ADA payment required)
@app.post("/create_project")
async def create_project(data: CreateProjectRequest):
    """Create a new project - requires 5 ADA payment"""
    try:
        # Generate project ID
        project_id = data.repoUrl.split("/")[-1].replace(".git", "") + "-" + str(int(uuid.uuid4().time_low))
        
        payload = {
            "endpoint": "/api/projects/create",
            "method": "POST",
            "data": {
                "repoUrl": data.repoUrl,
                "walletAddress": data.walletAddress,
                "side": data.side,
                "projectId": project_id
            }
        }
        
        return await create_payment_job(
            identifier_from_purchaser=data.identifier_from_purchaser,
            amount="5000000",  # 5 ADA
            action="create_project",
            payload=payload
        )
        
    except Exception as e:
        logger.error(f"Error in create_project: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

# 2) Setup Project Info (Free if project was paid for)
@app.post("/setup_info")
async def setup_info(data: SetupInfoRequest):
    """Setup project info - free for paid projects"""
    try:
        if data.projectId not in project_payments:
            raise HTTPException(status_code=402, detail="Project creation payment required first")
        
        result = await call_express_api(
            f"/api/projects/{data.projectId}/setup-info",
            "POST",
            {
                "name": data.name,
                "description": data.description,
                "technicalDescription": data.technicalDescription,
                "imageUrl": data.imageUrl
            }
        )
        
        return {"status": "success", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in setup_info: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to setup project info: {str(e)}")

# 3) Setup Socials (Free if project was paid for)
@app.post("/setup_socials")
async def setup_socials(data: SetupSocialsRequest):
    """Setup social media - free for paid projects"""
    try:
        if data.projectId not in project_payments:
            raise HTTPException(status_code=402, detail="Project creation payment required first")
        
        result = await call_express_api(
            f"/api/projects/{data.projectId}/setup-socials",
            "POST",
            {
                "twitter": data.twitter,
                "linkedin": data.linkedin,
                "telegram": data.telegram,
                "autoPost": data.autoPost,
                "character": data.character,
                "postsPerDay": data.postsPerDay
            }
        )
        
        return {"status": "success", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in setup_socials: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to setup socials: {str(e)}")

# 4) Setup Karma (Free if project was paid for)
@app.post("/setup_karma")
async def setup_karma(data: SetupKarmaRequest):
    """Setup Karma integration - free for paid projects"""
    try:
        if data.projectId not in project_payments:
            raise HTTPException(status_code=402, detail="Project creation payment required first")
        
        result = await call_express_api(
            f"/api/projects/{data.projectId}/setup-karma",
            "POST",
            {
                "title": data.title,
                "description": data.description,
                "imageURL": data.imageURL,
                "ownerAddress": data.ownerAddress,
                "ownerPkey": data.ownerPkey,
                "members": data.members,
                "membersPKey": data.membersPKey,
                "userEmail": data.userEmail,
                "userName": data.userName
            }
        )
        
        return {"status": "success", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in setup_karma: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to setup Karma: {str(e)}")

# 5) Setup IP (Free if project was paid for)
@app.post("/setup_ip")
async def setup_ip(data: SetupIPRequest):
    """Setup IP protection - free for paid projects"""
    try:
        if data.projectId not in project_payments:
            raise HTTPException(status_code=402, detail="Project creation payment required first")
        
        result = await call_express_api(
            f"/api/projects/{data.projectId}/setup-ip",
            "POST",
            {
                "title": data.title,
                "description": data.description,
                "imageURL": data.imageURL,
                "remixFee": data.remixFee,
                "commercialRevShare": data.commercialRevShare
            }
        )
        
        return {"status": "success", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in setup_ip: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to setup IP: {str(e)}")

# 6) Interact with Project (1 ADA payment required)
@app.post("/interact")
async def interact(data: InteractRequest):
    """Interact with project - requires 1 ADA payment"""
    try:
        payload = {
            "endpoint": f"/api/projects/{data.projectId}/interact",
            "method": "POST",
            "data": {
                "prompt": data.prompt
            }
        }
        
        return await create_payment_job(
            identifier_from_purchaser=data.identifier_from_purchaser,
            amount="1000000",  # 1 ADA
            action="interact",
            payload=payload
        )
        
    except Exception as e:
        logger.error(f"Error in interact: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process interaction: {str(e)}")

# 7) Analyze GitHub Repository (2 ADA payment required)
@app.post("/analyze")
async def analyze(data: AnalyzeRequest):
    """Analyze GitHub repository - requires 2 ADA payment"""
    try:
        payload = {
            "endpoint": "/api/github/analyze",
            "method": "POST",
            "data": {
                "repoUrl": data.repoUrl,
                "userId": data.userId,
                "projectKey": data.projectKey
            }
        }
        
        return await create_payment_job(
            identifier_from_purchaser=data.identifier_from_purchaser,
            amount="2000000",  # 2 ADA
            action="analyze",
            payload=payload
        )
        
    except Exception as e:
        logger.error(f"Error in analyze: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to analyze repository: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# Status and Management Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/status")
async def get_status(job_id: str):
    """Get job status"""
    logger.info(f"Checking status for job {job_id}")
    if job_id not in jobs:
        logger.warning(f"Job {job_id} not found")
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    # Check latest payment status if payment instance exists
    if job_id in payment_instances:
        try:
            status = await payment_instances[job_id].check_payment_status()
            job["payment_status"] = status.get("data", {}).get("status")
            logger.info(f"Updated payment status for job {job_id}: {job['payment_status']}")
        except Exception as e:
            logger.error(f"Error checking payment status: {str(e)}", exc_info=True)
            job["payment_status"] = "error"

    return {
        "job_id": job_id,
        "status": job["status"],
        "payment_status": job["payment_status"],
        "action": job.get("action"),
        "result": job.get("result")
    }

@app.get("/availability")
async def check_availability():
    """Check server availability"""
    return {"status": "available", "type": "jedi-payment-middleware", "message": "Jedi payment middleware operational."}

@app.get("/input_schema")
async def input_schema():
    """Return input schemas for different endpoints"""
    return {
        "create_project": {
            "identifier_from_purchaser": "string",
            "repoUrl": "string", 
            "walletAddress": "string",
            "side": "string (light|dark)"
        },
        "interact": {
            "identifier_from_purchaser": "string",
            "projectId": "string",
            "prompt": "string"
        },
        "analyze": {
            "identifier_from_purchaser": "string",
            "repoUrl": "string",
            "userId": "string",
            "projectKey": "string"
        }
    }

@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy", "service": "jedi-payment-middleware"}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        print("Starting Jedi Payment Middleware...")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        print("Use 'python main.py api' to start the payment middleware")