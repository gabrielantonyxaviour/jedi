// src/agents/email.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { KMSClient, EncryptCommand } from "@aws-sdk/client-kms";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

interface Project {
  projectId: string;
  owner: string;
  name: string;
  description: string;
  email: string;
  userName: string;
  createdAt: string;
  lastAnalyzed?: string;
  summary?: string;
  githubUrl?: string;
}

interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  timestamp: number;
  encrypted: boolean;
}

export class EmailAgent {
  private ses: SESClient;
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private kms: KMSClient;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private kmsKeyId: string;
  private bucketName: string;
  private emailTableName: string;
  private projectsTableName: string;
  private fromEmail: string;
  private orchestratorQueue: string;

  constructor() {
    this.ses = new SESClient({ region: process.env.AWS_REGION });
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.kms = new KMSClient({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });

    this.kmsKeyId = process.env.KMS_KEY_ID!;
    this.bucketName = process.env.EMAIL_BUCKET_NAME!;
    this.emailTableName = process.env.EMAIL_TABLE_NAME!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.fromEmail = process.env.FROM_EMAIL!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async createProject(projectData: {
    name: string;
    description: string;
    email: string;
    userName: string;
    githubUrl?: string;
  }): Promise<Project> {
    const projectId = this.generateProjectId(projectData.name);

    const project: Project = {
      projectId,
      owner: `${projectData.userName}/${projectData.name}`,
      name: projectData.name,
      description: projectData.description,
      email: projectData.email,
      userName: projectData.userName,
      createdAt: new Date().toISOString(),
      githubUrl: projectData.githubUrl,
    };

    await this.storeProject(project);
    await this.sendProjectWelcomeEmail(project);
    return project;
  }

  async sendEmail(
    to: string[],
    subject: string,
    body: string,
    htmlBody?: string,
    cc?: string[]
  ): Promise<string> {
    const messageId = randomUUID();

    const emailParams: any = {
      Source: this.fromEmail,
      Destination: {
        ToAddresses: to,
        CcAddresses: cc || [],
      },
      Message: {
        Subject: { Data: subject },
        Body: {},
      },
    };

    if (htmlBody) {
      emailParams.Message.Body.Html = { Data: htmlBody };
      emailParams.Message.Body.Text = { Data: body };
    } else {
      emailParams.Message.Body.Text = { Data: body };
    }

    await this.ses.send(new SendEmailCommand(emailParams));

    const emailMessage: EmailMessage = {
      id: messageId,
      threadId: this.generateThreadId(subject),
      from: this.fromEmail,
      to,
      subject,
      body: await this.encryptContent(body),
      timestamp: Date.now(),
      encrypted: true,
    };

    await this.storeEmail(emailMessage);
    return messageId;
  }

  async processIncomingEmail(rawEmail: any): Promise<void> {
    const { from, subject, body, messageId } = this.parseRawEmail(rawEmail);

    console.log(`📧 Processing incoming email from ${from}: ${subject}`);

    const emailMessage: EmailMessage = {
      id: messageId,
      threadId: this.generateThreadId(subject),
      from,
      to: [this.fromEmail],
      subject,
      body: await this.encryptContent(body),
      timestamp: Date.now(),
      encrypted: true,
    };

    await this.storeEmail(emailMessage);

    const userProjects = await this.getUserProjects(from);
    const response = await this.generateContextualResponse(
      body,
      subject,
      userProjects
    );

    await this.sendEmail(
      [from],
      `Re: ${subject}`,
      response.text,
      response.html
    );
  }

  async processEmailTask(task: any): Promise<void> {
    console.log(`📧 Processing email task: ${task.type}`);

    try {
      switch (task.type) {
        case "CREATE_PROJECT":
          const project = await this.createProject(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            project,
          });
          break;
        case "SOCIAL_INTERVENTION":
          await this.sendSocialInterventionEmail(task.payload);
          break;

        case "COMPLIANCE_ALERT":
          await this.sendComplianceAlert(task.payload);
          break;

        case "GRANT_OPPORTUNITY":
          await this.sendGrantAlert(task.payload);
          break;

        case "LEAD_OPPORTUNITY":
          await this.sendLeadAlert(task.payload);
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      if (task.taskId && task.workflowId) {
        await this.reportTaskCompletion(
          task.taskId,
          task.workflowId,
          null,
          error.message
        );
      }
      throw error;
    }
  }

  private async sendProjectWelcomeEmail(project: Project): Promise<void> {
    const subject = `Welcome to ${project.name} - Your Project is Ready! 🎉`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .project-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to ${project.name}!</h1>
            <p>Your intelligent project assistant is ready</p>
        </div>
        
        <div class="content">
            <p>Hi ${project.userName},</p>
            
            <p>Congratulations! Your project <strong>${
              project.name
            }</strong> has been successfully created.</p>
            
            <div class="project-info">
                <h3>📋 Project Details</h3>
                <p><strong>Project Name:</strong> ${project.name}</p>
                <p><strong>Description:</strong> ${project.description}</p>
                <p><strong>Project ID:</strong> ${project.projectId}</p>
                <p><strong>Created:</strong> ${new Date(
                  project.createdAt
                ).toLocaleDateString()}</p>
                ${
                  project.githubUrl
                    ? `<p><strong>GitHub:</strong> <a href="${project.githubUrl}">${project.githubUrl}</a></p>`
                    : ""
                }
            </div>
            
            <h3>🚀 What's Next?</h3>
            <ul>
                <li>Connect your GitHub repository for automated analysis</li>
                <li>Reply to this email for project assistance</li>
                <li>Get AI-powered insights and recommendations</li>
                <li>Set up automated workflows</li>
            </ul>
            
            <p>Simply reply to this email with any questions!</p>
        </div>
        
        <div class="footer">
            <p>Project Intelligence System | Project ID: ${
              project.projectId
            }</p>
        </div>
    </div>
</body>
</html>
    `;

    const textBody = `
Welcome to ${project.name}!

Hi ${project.userName},

Your project "${project.name}" has been successfully created.

Project Details:
- Name: ${project.name}
- Description: ${project.description}  
- Project ID: ${project.projectId}
- Created: ${new Date(project.createdAt).toLocaleDateString()}
${project.githubUrl ? `- GitHub: ${project.githubUrl}` : ""}

What's Next:
- Connect your GitHub repository for automated analysis
- Reply to this email for project assistance  
- Get AI-powered insights and recommendations
- Set up automated workflows

Simply reply to this email with any questions!

---
Project Intelligence System | Project ID: ${project.projectId}
    `;

    await this.sendEmail([project.email], subject, textBody, htmlBody);
  }

  private async sendSocialInterventionEmail(payload: {
    userEmail: string;
    userName: string;
    projectName: string;
    platform: string;
    contentType: string;
    content: string;
    action: string;
    urgency: "high" | "medium" | "low";
    deadline?: string;
  }): Promise<void> {
    const subject = `🚨 Action Required: ${payload.platform} ${payload.contentType} - ${payload.projectName}`;

    const urgencyColor =
      payload.urgency === "high"
        ? "#dc3545"
        : payload.urgency === "medium"
        ? "#fd7e14"
        : "#ffc107";
    const urgencyText =
      payload.urgency === "high"
        ? "URGENT"
        : payload.urgency === "medium"
        ? "MEDIUM"
        : "LOW";

    const htmlBody = `
 <!DOCTYPE html>
 <html>
 <head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #fff5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border: 2px solid #fee; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; padding: 30px; text-align: center; }
        .urgency-badge { background-color: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .content { padding: 30px; }
        .alert-box { background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .content-preview { background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; font-family: monospace; border-left: 3px solid #6c757d; }
        .action-button { display: inline-block; background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; text-transform: uppercase; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-top: 1px solid #dee2e6; }
        .deadline { color: #dc3545; font-weight: bold; }
    </style>
 </head>
 <body>
    <div class="container">
        <div class="header">
            <div style="margin-bottom: 10px;">
                <span class="urgency-badge">${urgencyText} PRIORITY</span>
            </div>
            <h1>🚨 Manual Action Required</h1>
            <p>Social media intervention needed for ${payload.projectName}</p>
        </div>
        
        <div class="content">
            <div class="alert-box">
                <h3>⚠️ Immediate Attention Needed</h3>
                <p>Our social media monitoring has detected activity on <strong>${
                  payload.platform
                }</strong> that requires your manual review and action.</p>
                ${
                  payload.deadline
                    ? `<p class="deadline">⏰ Deadline: ${payload.deadline}</p>`
                    : ""
                }
            </div>
            
            <h3>📋 Details</h3>
            <ul>
                <li><strong>Platform:</strong> ${payload.platform}</li>
                <li><strong>Content Type:</strong> ${payload.contentType}</li>
                <li><strong>Project:</strong> ${payload.projectName}</li>
                <li><strong>Required Action:</strong> ${payload.action}</li>
            </ul>
            
            <h3>📄 Content Preview</h3>
            <div class="content-preview">${payload.content}</div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="#" class="action-button">Take Action Now</a>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Review the flagged content above</li>
                <li>Determine appropriate response strategy</li>
                <li>Take action on the ${payload.platform} platform</li>
                <li>Monitor engagement and follow-up</li>
            </ol>
        </div>
        
        <div class="footer">
            <p>🤖 Social Media Intelligence Alert | Project: ${
              payload.projectName
            }</p>
            <p>This alert was generated automatically based on your social media monitoring rules.</p>
        </div>
    </div>
 </body>
 </html>`;

    const textBody = `🚨 ACTION REQUIRED - ${urgencyText} PRIORITY
 
 Social Media Intervention Needed
 
 Hi ${payload.userName},
 
 Our monitoring system has detected activity on ${
   payload.platform
 } that requires your immediate attention for project "${payload.projectName}".
 
 Details:
 - Platform: ${payload.platform}
 - Content Type: ${payload.contentType}
 - Required Action: ${payload.action}
 ${payload.deadline ? `- Deadline: ${payload.deadline}` : ""}
 
 Content Preview:
 ${payload.content}
 
 Next Steps:
 1. Review the flagged content
 2. Determine appropriate response strategy  
 3. Take action on ${payload.platform}
 4. Monitor engagement and follow-up
 
 ---
 Social Media Intelligence Alert | Project: ${payload.projectName}`;

    await this.sendEmail([payload.userEmail], subject, textBody, htmlBody);
  }

  private async sendComplianceAlert(payload: {
    userEmail: string;
    userName: string;
    projectName: string;
    similarIdea: {
      title: string;
      description: string;
      source: string;
      url: string;
      similarity: number;
      dateFound: string;
    };
    disputeInstructions: string;
  }): Promise<void> {
    const subject = `⚖️ Compliance Alert: Similar Idea Found - ${payload.projectName}`;

    const htmlBody = `
 <!DOCTYPE html>
 <html>
 <head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #fffbf0; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border: 2px solid #fff3cd; }
        .header { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); color: #212529; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .warning-box { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .similarity-meter { background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .similarity-bar { background-color: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; }
        .similarity-fill { background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%); height: 100%; border-radius: 10px; }
        .idea-preview { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #ffc107; }
        .dispute-button { display: inline-block; background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
    </style>
 </head>
 <body>
    <div class="container">
        <div class="header">
            <h1>⚖️ Intellectual Property Alert</h1>
            <p>Similar idea detected for ${payload.projectName}</p>
        </div>
        
        <div class="content">
            <div class="warning-box">
                <h3>🔍 Compliance Monitoring Alert</h3>
                <p>Our AI-powered compliance system has identified a potentially similar idea to your project. Review required to determine if action is needed.</p>
            </div>
            
            <div class="similarity-meter">
                <h4>📊 Similarity Analysis</h4>
                <div class="similarity-bar">
                    <div class="similarity-fill" style="width: ${
                      payload.similarIdea.similarity
                    }%"></div>
                </div>
                <p style="text-align: center; margin: 10px 0;"><strong>${
                  payload.similarIdea.similarity
                }% Similarity Match</strong></p>
            </div>
            
            <div class="idea-preview">
                <h4>💡 Similar Idea Found</h4>
                <p><strong>Title:</strong> ${payload.similarIdea.title}</p>
                <p><strong>Description:</strong> ${
                  payload.similarIdea.description
                }</p>
                <p><strong>Source:</strong> ${payload.similarIdea.source}</p>
                <p><strong>URL:</strong> <a href="${
                  payload.similarIdea.url
                }" target="_blank">${payload.similarIdea.url}</a></p>
                <p><strong>Discovered:</strong> ${new Date(
                  payload.similarIdea.dateFound
                ).toLocaleDateString()}</p>
            </div>
            
            <h3>🛡️ Recommended Actions</h3>
            <ol>
                <li><strong>Review:</strong> Examine the similar idea carefully</li>
                <li><strong>Analyze:</strong> Compare with your project's unique aspects</li>
                <li><strong>Document:</strong> Gather evidence of your project's originality</li>
                <li><strong>Consult:</strong> Consider legal advice if necessary</li>
                <li><strong>Dispute:</strong> File a dispute if you believe there's infringement</li>
            </ol>
            
            <div class="warning-box">
                <h4>📋 Dispute Instructions</h4>
                <p>${payload.disputeInstructions}</p>
            </div>
            
            <div style="text-align: center;">
                <a href="#" class="dispute-button">Initiate Dispute Process</a>
            </div>
            
            <p><em>Note: This alert is for informational purposes. The similarity detection is automated and may include false positives. Always conduct thorough analysis before taking legal action.</em></p>
        </div>
        
        <div class="footer">
            <p>🛡️ IP Compliance Monitor | Project: ${payload.projectName}</p>
            <p>Automated similarity detection • ${
              payload.similarIdea.similarity
            }% match confidence</p>
        </div>
    </div>
 </body>
 </html>`;

    const textBody = `⚖️ COMPLIANCE ALERT: Similar Idea Found
 
 IP Monitoring Alert for ${payload.projectName}
 
 Hi ${payload.userName},
 
 Our compliance monitoring system has detected a potentially similar idea to your project.
 
 SIMILARITY ANALYSIS:
 ${payload.similarIdea.similarity}% Match Confidence
 
 SIMILAR IDEA DETAILS:
 Title: ${payload.similarIdea.title}
 Description: ${payload.similarIdea.description}
 Source: ${payload.similarIdea.source}
 URL: ${payload.similarIdea.url}
 Discovered: ${new Date(payload.similarIdea.dateFound).toLocaleDateString()}
 
 RECOMMENDED ACTIONS:
 1. Review the similar idea carefully
 2. Analyze compared to your project's unique aspects
 3. Document evidence of your project's originality
 4. Consider legal consultation if necessary
 5. File dispute if infringement is suspected
 
 DISPUTE INSTRUCTIONS:
 ${payload.disputeInstructions}
 
 Note: This is an automated alert. Similarity detection may include false positives. Conduct thorough analysis before legal action.
 
 ---
 IP Compliance Monitor | ${payload.similarIdea.similarity}% match confidence`;

    await this.sendEmail([payload.userEmail], subject, textBody, htmlBody);
  }

  private async sendGrantAlert(payload: {
    userEmail: string;
    userName: string;
    projectName: string;
    grant: {
      title: string;
      organization: string;
      amount: string;
      deadline: string;
      description: string;
      eligibility: string[];
      applicationUrl: string;
      matchScore: number;
    };
  }): Promise<void> {
    const subject = `💰 Grant Opportunity: ${payload.grant.title} - Perfect Match for ${payload.projectName}!`;

    const htmlBody = `
 <!DOCTYPE html>
 <html>
 <head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f0fff4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border: 2px solid #d4edda; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .opportunity-box { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-radius: 12px; padding: 25px; margin: 20px 0; text-align: center; }
        .amount-highlight { font-size: 2.5em; font-weight: bold; color: #28a745; margin: 10px 0; }
        .match-score { background-color: #28a745; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .deadline-alert { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0; text-align: center; }
        .grant-details { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .eligibility-list { background-color: #e8f5e8; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .apply-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 20px 0; font-size: 18px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
    </style>
 </head>
 <body>
    <div class="container">
        <div class="header">
            <h1>💰 Grant Opportunity Alert!</h1>
            <p>Perfect funding match found for ${payload.projectName}</p>
        </div>
        
        <div class="content">
            <div class="opportunity-box">
                <h2>${payload.grant.title}</h2>
                <div class="amount-highlight">${payload.grant.amount}</div>
                <p><strong>by ${payload.grant.organization}</strong></p>
                <div class="match-score">${
                  payload.grant.matchScore
                }% Project Match</div>
            </div>
            
            <div class="deadline-alert">
                <h3>⏰ Application Deadline</h3>
                <p style="font-size: 1.2em; font-weight: bold; color: #e67e22; margin: 5px 0;">${new Date(
                  payload.grant.deadline
                ).toLocaleDateString()}</p>
                <p>Days remaining: <strong>${Math.ceil(
                  (new Date(payload.grant.deadline).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )}</strong></p>
            </div>
            
            <div class="grant-details">
                <h3>📋 Grant Description</h3>
                <p>${payload.grant.description}</p>
            </div>
            
            <div class="eligibility-list">
                <h3>✅ Eligibility Requirements</h3>
                <ul>
                    ${payload.grant.eligibility
                      .map((req) => `<li>${req}</li>`)
                      .join("")}
                </ul>
            </div>
            
            <h3>🚀 Why This Grant Matches Your Project</h3>
            <ul>
                <li>High compatibility score (${payload.grant.matchScore}%)</li>
                <li>Aligns with ${payload.projectName}'s objectives</li>
                <li>Funding amount suitable for your project scale</li>
                <li>Timeline matches your development roadmap</li>
            </ul>
            
            <h3>📝 Next Steps</h3>
            <ol>
                <li><strong>Review requirements</strong> - Ensure full eligibility</li>
                <li><strong>Prepare documentation</strong> - Gather required materials</li>
                <li><strong>Draft proposal</strong> - Tailor to grant objectives</li>
                <li><strong>Submit early</strong> - Don't wait until deadline</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  payload.grant.applicationUrl
                }" class="apply-button" target="_blank">Apply Now 🚀</a>
            </div>
            
            <p style="text-align: center; color: #28a745; font-weight: bold;">Good luck with your application! 🍀</p>
        </div>
        
        <div class="footer">
            <p>💰 Grant Intelligence System | Project: ${
              payload.projectName
            }</p>
            <p>AI-powered grant matching • ${
              payload.grant.matchScore
            }% compatibility score</p>
        </div>
    </div>
 </body>
 </html>`;

    const textBody = `💰 GRANT OPPORTUNITY ALERT!
 
 Perfect Funding Match Found for ${payload.projectName}
 
 Hi ${payload.userName},
 
 Great news! Our grant intelligence system has found an excellent funding opportunity for your project.
 
 GRANT DETAILS:
 ${payload.grant.title}
 Organization: ${payload.grant.organization}
 Amount: ${payload.grant.amount}
 Match Score: ${payload.grant.matchScore}%
 
 APPLICATION DEADLINE: ${new Date(payload.grant.deadline).toLocaleDateString()}
 Days Remaining: ${Math.ceil(
   (new Date(payload.grant.deadline).getTime() - Date.now()) /
     (1000 * 60 * 60 * 24)
 )}
 
 DESCRIPTION:
 ${payload.grant.description}
 
 ELIGIBILITY REQUIREMENTS:
 ${payload.grant.eligibility.map((req, i) => `${i + 1}. ${req}`).join("\n")}
 
 WHY THIS MATCHES YOUR PROJECT:
 - High compatibility score (${payload.grant.matchScore}%)
 - Aligns with ${payload.projectName}'s objectives
 - Suitable funding amount for your project scale
 - Timeline matches your development roadmap
 
 NEXT STEPS:
 1. Review requirements - Ensure full eligibility
 2. Prepare documentation - Gather required materials
 3. Draft proposal - Tailor to grant objectives
 4. Submit early - Don't wait until deadline
 
 APPLICATION URL: ${payload.grant.applicationUrl}
 
 Good luck with your application! 🍀
 
 ---
 Grant Intelligence System | ${payload.grant.matchScore}% compatibility score`;

    await this.sendEmail([payload.userEmail], subject, textBody, htmlBody);
  }

  private async sendLeadAlert(payload: {
    userEmail: string;
    userName: string;
    projectName: string;
    lead: {
      company: string;
      contactName: string;
      contactEmail?: string;
      industry: string;
      opportunity: string;
      value: string;
      source: string;
      confidence: number;
      nextSteps: string[];
    };
  }): Promise<void> {
    const subject = `🎯 New Lead Opportunity: ${payload.lead.company} - ${payload.projectName}`;

    const htmlBody = `
 <!DOCTYPE html>
 <html>
 <head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f0f8ff; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border: 2px solid #cce7ff; }
        .header { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .lead-highlight { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 12px; padding: 25px; margin: 20px 0; text-align: center; }
        .value-highlight { font-size: 2em; font-weight: bold; color: #007bff; margin: 10px 0; }
        .confidence-score { background-color: #007bff; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .company-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #007bff; }
        .opportunity-details { background-color: #e8f4f8; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .contact-info { background-color: #fff3e0; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .action-button { display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
        .next-steps { background-color: #f0f8ff; border-radius: 8px; padding: 20px; margin: 15px 0; }
    </style>
 </head>
 <body>
    <div class="container">
        <div class="header">
            <h1>🎯 New Lead Opportunity</h1>
            <p>High-value prospect identified for ${payload.projectName}</p>
        </div>
        
        <div class="content">
            <div class="lead-highlight">
                <h2>🏢 ${payload.lead.company}</h2>
                <div class="value-highlight">${payload.lead.value}</div>
                <p><strong>Potential Value</strong></p>
                <div class="confidence-score">${
                  payload.lead.confidence
                }% Confidence</div>
            </div>
            
            <div class="company-info">
                <h3>🏭 Company Information</h3>
                <p><strong>Company:</strong> ${payload.lead.company}</p>
                <p><strong>Industry:</strong> ${payload.lead.industry}</p>
                <p><strong>Lead Source:</strong> ${payload.lead.source}</p>
                <p><strong>Contact Person:</strong> ${
                  payload.lead.contactName
                }</p>
                ${
                  payload.lead.contactEmail
                    ? `<p><strong>Email:</strong> <a href="mailto:${payload.lead.contactEmail}">${payload.lead.contactEmail}</a></p>`
                    : ""
                }
            </div>
            
            <div class="opportunity-details">
                <h3>💼 Opportunity Details</h3>
                <p>${payload.lead.opportunity}</p>
            </div>
            
            <div class="next-steps">
                <h3>🚀 Recommended Next Steps</h3>
                <ol>
                    ${payload.lead.nextSteps
                      .map((step) => `<li>${step}</li>`)
                      .join("")}
                </ol>
            </div>
            
            <h3>📊 Why This Lead Matters</h3>
            <ul>
                <li>High confidence score (${payload.lead.confidence}%)</li>
                <li>Strong industry alignment with ${payload.projectName}</li>
                <li>Significant potential value (${payload.lead.value})</li>
                <li>Quality lead source: ${payload.lead.source}</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
                ${
                  payload.lead.contactEmail
                    ? `<a href="mailto:${payload.lead.contactEmail}?subject=Partnership Opportunity - ${payload.projectName}" class="action-button">Send Email 📧</a>`
                    : ""
                }
                <a href="#" class="action-button">View Full Profile 👀</a>
                <a href="#" class="action-button">Schedule Follow-up ⏰</a>
            </div>
            
            <div class="contact-info">
                <h4>📞 Contact Strategy</h4>
                <p>Based on the lead profile, we recommend:</p>
                <ul>
                    <li>Professional email introduction highlighting mutual benefits</li>
                    <li>Mention specific industry challenges your project solves</li>
                    <li>Request brief discovery call to explore partnership</li>
                    <li>Follow up within 3-5 business days if no response</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>🎯 Lead Intelligence System | Project: ${payload.projectName}</p>
            <p>AI-powered lead discovery • ${
              payload.lead.confidence
            }% confidence score</p>
        </div>
    </div>
 </body>
 </html>`;

    const textBody = `🎯 NEW LEAD OPPORTUNITY
 
 High-Value Prospect for ${payload.projectName}
 
 Hi ${payload.userName},
 
 Excellent news! Our lead intelligence system has identified a high-potential business opportunity.
 
 LEAD DETAILS:
 Company: ${payload.lead.company}
 Industry: ${payload.lead.industry}
 Contact: ${payload.lead.contactName}
 ${payload.lead.contactEmail ? `Email: ${payload.lead.contactEmail}` : ""}
 Potential Value: ${payload.lead.value}
 Confidence Score: ${payload.lead.confidence}%
 Source: ${payload.lead.source}
 
 OPPORTUNITY:
 ${payload.lead.opportunity}
 
 RECOMMENDED NEXT STEPS:
 ${payload.lead.nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")}
 
 WHY THIS LEAD MATTERS:
 - High confidence score (${payload.lead.confidence}%)
 - Strong industry alignment with ${payload.projectName}
 - Significant potential value (${payload.lead.value})
 - Quality lead source: ${payload.lead.source}
 
 CONTACT STRATEGY:
 - Send professional email introduction highlighting mutual benefits
 - Mention specific industry challenges your project solves
 - Request brief discovery call to explore partnership
 - Follow up within 3-5 business days if no response
 
 ${
   payload.lead.contactEmail
     ? `Quick Email: mailto:${payload.lead.contactEmail}?subject=Partnership Opportunity - ${payload.projectName}`
     : ""
 }
 
 ---
 Lead Intelligence System | ${payload.lead.confidence}% confidence score`;

    await this.sendEmail([payload.userEmail], subject, textBody, htmlBody);
  }

  private async generateContextualResponse(
    emailBody: string,
    subject: string,
    userProjects: Project[]
  ): Promise<{ text: string; html: string }> {
    const projectContext = userProjects
      .map(
        (p) =>
          `Project: ${p.name}\nDescription: ${p.description}\nCreated: ${
            p.createdAt
          }\nSummary: ${p.summary || "No analysis yet"}`
      )
      .join("\n\n---\n\n");

    const prompt = `
You are an AI assistant for a project intelligence system. A user has sent an email and you need to respond professionally and helpfully.

USER'S PROJECTS CONTEXT:
${projectContext || "No projects found for this user."}

EMAIL SUBJECT: ${subject}
EMAIL BODY: ${emailBody}

Generate a helpful, professional email response. If they're asking about their projects, use the context above. If they need technical help, provide clear guidance. Keep the tone friendly but professional. Sign off as "Your Project Intelligence Assistant".
    `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const responseText = result.content[0].text;

    const htmlResponse = responseText
      .split("\n\n")
      .map((paragraph: string) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");

    return {
      text: responseText,
      html: `<div style="font-family: system-ui, sans-serif; line-height: 1.6;">${htmlResponse}</div>`,
    };
  }

  private async getUserProjects(email: string): Promise<Project[]> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.projectsTableName,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: marshall({ ":email": email }),
      })
    );

    return (response.Items || []).map((item) => unmarshall(item) as Project);
  }

  private async storeProject(project: Project): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.projectsTableName,
        Item: marshall(project),
      })
    );
  }

  private async storeEmail(email: EmailMessage): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.emailTableName,
        Item: marshall(email),
      })
    );
  }

  private async encryptContent(content: string): Promise<string> {
    const response = await this.kms.send(
      new EncryptCommand({
        KeyId: this.kmsKeyId,
        Plaintext: new TextEncoder().encode(content),
      })
    );
    return Buffer.from(response.CiphertextBlob!).toString("base64");
  }

  private generateProjectId(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
  }

  private generateThreadId(subject: string): string {
    return Buffer.from(subject.replace(/^(Re:|Fwd:)\s*/i, "").trim()).toString(
      "base64"
    );
  }

  private parseRawEmail(rawEmail: any) {
    return {
      from: rawEmail.source || rawEmail.from,
      subject: rawEmail.subject,
      body: rawEmail.body,
      messageId: rawEmail.messageId || randomUUID(),
    };
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
  ) {
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            payload: {
              taskId,
              workflowId,
              status: error ? "FAILED" : "COMPLETED",
              result,
              error,
              timestamp: new Date().toISOString(),
              agent: "email-communication",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
