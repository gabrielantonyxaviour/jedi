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
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID as uuidv4 } from "crypto";

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

export class EmailService {
  private ses: SESClient;
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private kms: KMSClient;
  private kmsKeyId: string;
  private bucketName: string;
  private emailTableName: string;
  private projectsTableName: string;
  private fromEmail: string;

  constructor() {
    this.ses = new SESClient({ region: process.env.AWS_REGION });
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.kms = new KMSClient({ region: process.env.AWS_REGION });

    this.kmsKeyId = process.env.KMS_KEY_ID!;
    this.bucketName = process.env.EMAIL_BUCKET_NAME!;
    this.emailTableName = process.env.EMAIL_TABLE_NAME!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.fromEmail = process.env.FROM_EMAIL!;
  }

  async sendEmail(
    to: string[],
    subject: string,
    body: string,
    htmlBody?: string,
    cc?: string[]
  ): Promise<string> {
    const messageId = uuidv4();

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
    return project;
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
    const command = new EncryptCommand({
      KeyId: this.kmsKeyId,
      Plaintext: Buffer.from(content),
    });

    const response = await this.kms.send(command);
    return Buffer.from(response.CiphertextBlob!).toString("base64");
  }

  private generateProjectId(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
  }

  private generateThreadId(subject: string): string {
    return `thread-${subject
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
  }
}
