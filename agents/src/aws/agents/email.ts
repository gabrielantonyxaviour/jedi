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
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
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

        case "SEND_EMAIL":
          const messageId = await this.sendEmail(
            task.payload.to,
            task.payload.subject,
            task.payload.body,
            task.payload.htmlBody,
            task.payload.cc
          );
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            messageId,
          });
          break;
      }
    } catch (error: any) {
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
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
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
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
