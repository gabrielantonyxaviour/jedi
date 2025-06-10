// src/agents/monitoring-compliance.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  CloudWatchClient,
  PutMetricDataCommand,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

interface ComplianceCheck {
  checkId: string;
  projectId: string;
  checkType:
    | "gdpr"
    | "ccpa"
    | "security"
    | "accessibility"
    | "licensing"
    | "data_retention";
  status: "passed" | "failed" | "warning" | "pending";
  findings: Array<{
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    recommendation: string;
    location?: string;
  }>;
  checkedAt: string;
  nextCheckDue?: string;
}

interface MonitoringAlert {
  alertId: string;
  projectId: string;
  alertType:
    | "performance"
    | "security"
    | "compliance"
    | "availability"
    | "cost";
  severity: "critical" | "warning" | "info";
  message: string;
  details: any;
  triggeredAt: string;
  resolvedAt?: string;
  status: "active" | "acknowledged" | "resolved";
}

export class ComplianceAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private sns: SNSClient;
  private cloudwatch: CloudWatchClient;
  private bedrock: BedrockRuntimeClient;
  private complianceTableName: string;
  private alertsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private alertTopicArn: string;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.sns = new SNSClient({ region: process.env.AWS_REGION });
    this.cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

    this.complianceTableName = process.env.COMPLIANCE_CHECKS_TABLE!;
    this.alertsTableName = process.env.MONITORING_ALERTS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.MONITORING_BUCKET!;
    this.alertTopicArn = process.env.ALERT_TOPIC_ARN!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔍 Processing monitoring/compliance task: ${task.type}`);

    try {
      switch (task.type) {
        case "RUN_COMPLIANCE_CHECK":
          const complianceResult = await this.runComplianceCheck(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            complianceResult,
          });
          break;

        case "MONITOR_PROJECT":
          const monitoringResult = await this.monitorProject(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            monitoringResult,
          });
          break;

        case "GENERATE_COMPLIANCE_REPORT":
          const report = await this.generateComplianceReport(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            report,
          });
          break;

        case "AUDIT_SYSTEM":
          const auditResult = await this.auditSystem(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            auditResult,
          });
          break;

        case "CHECK_VULNERABILITIES":
          const vulnResult = await this.checkVulnerabilities(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            vulnResult,
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

  async runComplianceCheck(payload: {
    projectId: string;
    checkTypes: string[];
    repositoryUrl?: string;
  }): Promise<ComplianceCheck[]> {
    const results: ComplianceCheck[] = [];

    for (const checkType of payload.checkTypes) {
      console.log(
        `🔍 Running ${checkType} compliance check for project ${payload.projectId}`
      );

      const check: ComplianceCheck = {
        checkId: randomUUID(),
        projectId: payload.projectId,
        checkType: checkType as any,
        status: "pending",
        findings: [],
        checkedAt: new Date().toISOString(),
      };

      switch (checkType) {
        case "gdpr":
          check.findings = await this.checkGDPRCompliance(payload);
          break;
        case "security":
          check.findings = await this.checkSecurityCompliance(payload);
          break;
        case "accessibility":
          check.findings = await this.checkAccessibilityCompliance(payload);
          break;
        case "licensing":
          check.findings = await this.checkLicensingCompliance(payload);
          break;
        default:
          check.findings = [];
      }

      // Determine overall status
      const criticalFindings = check.findings.filter(
        (f) => f.severity === "critical"
      );
      const highFindings = check.findings.filter((f) => f.severity === "high");

      if (criticalFindings.length > 0) {
        check.status = "failed";
      } else if (highFindings.length > 0) {
        check.status = "warning";
      } else {
        check.status = "passed";
      }

      // Set next check date
      check.nextCheckDue = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(); // 30 days

      await this.storeComplianceCheck(check);
      results.push(check);

      // Send alerts for critical findings
      if (criticalFindings.length > 0) {
        await this.sendComplianceAlert(check);
      }
    }

    return results;
  }

  async monitorProject(payload: {
    projectId: string;
    metrics: string[];
  }): Promise<any> {
    console.log(`📊 Monitoring project ${payload.projectId}`);

    const alerts: MonitoringAlert[] = [];
    const metrics = {
      performance: await this.checkPerformanceMetrics(payload.projectId),
      availability: await this.checkAvailabilityMetrics(payload.projectId),
      errorRate: await this.checkErrorRateMetrics(payload.projectId),
      resourceUsage: await this.checkResourceUsage(payload.projectId),
    };

    // Check for threshold violations
    if (metrics.performance.averageResponseTime > 5000) {
      alerts.push(
        await this.createAlert(
          payload.projectId,
          "performance",
          "warning",
          "High response time detected",
          { averageResponseTime: metrics.performance.averageResponseTime }
        )
      );
    }

    if (metrics.availability.uptime < 99.9) {
      alerts.push(
        await this.createAlert(
          payload.projectId,
          "availability",
          "critical",
          "Low availability detected",
          { uptime: metrics.availability.uptime }
        )
      );
    }

    if (metrics.errorRate.rate > 5) {
      alerts.push(
        await this.createAlert(
          payload.projectId,
          "performance",
          "high",
          "High error rate detected",
          { errorRate: metrics.errorRate.rate }
        )
      );
    }

    // Store metrics
    await this.storeMetrics(payload.projectId, metrics);

    return {
      projectId: payload.projectId,
      metrics,
      alerts: alerts.length,
      status: alerts.some((a) => a.severity === "critical")
        ? "critical"
        : alerts.some((a) => a.severity === "warning")
        ? "warning"
        : "healthy",
    };
  }

  async generateComplianceReport(payload: {
    projectId: string;
    period: string;
  }): Promise<any> {
    const checks = await this.getComplianceHistory(
      payload.projectId,
      payload.period
    );

    const prompt = `
Generate a comprehensive compliance report for this project:

Project ID: ${payload.projectId}
Period: ${payload.period}

Compliance Checks:
${checks
  .map(
    (check) =>
      `- ${check.checkType}: ${check.status} (${check.findings.length} findings)`
  )
  .join("\n")}

Key Findings:
${checks
  .flatMap((check) => check.findings)
  .filter(
    (finding) => finding.severity === "critical" || finding.severity === "high"
  )
  .map(
    (finding) => `- ${finding.severity.toUpperCase()}: ${finding.description}`
  )
  .join("\n")}

Create a professional compliance report with:
1. Executive Summary
2. Compliance Status Overview
3. Critical Findings and Recommendations
4. Trend Analysis
5. Action Items
6. Next Steps

Format in markdown with clear sections.
    `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const reportContent = result.content[0].text;

    // Store report
    const reportId = randomUUID();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `compliance-reports/${payload.projectId}/${reportId}.md`,
        Body: reportContent,
        ContentType: "text/markdown",
      })
    );

    return {
      reportId,
      projectId: payload.projectId,
      period: payload.period,
      generatedAt: new Date().toISOString(),
      content: reportContent,
      summary: {
        totalChecks: checks.length,
        passed: checks.filter((c) => c.status === "passed").length,
        failed: checks.filter((c) => c.status === "failed").length,
        warnings: checks.filter((c) => c.status === "warning").length,
      },
    };
  }

  async auditSystem(payload: {
    scope: string;
    auditType: string;
  }): Promise<any> {
    console.log(`🔍 Running system audit: ${payload.auditType}`);

    const auditResults = {
      auditId: randomUUID(),
      scope: payload.scope,
      auditType: payload.auditType,
      startedAt: new Date().toISOString(),
      findings: [] as any[],
      recommendations: [] as string[],
      riskLevel: "low",
    };

    switch (payload.auditType) {
      case "security":
        auditResults.findings = await this.auditSecurity();
        break;
      case "data-privacy":
        auditResults.findings = await this.auditDataPrivacy();
        break;
      case "access-control":
        auditResults.findings = await this.auditAccessControl();
        break;
    }

    // Generate recommendations
    auditResults.recommendations = await this.generateAuditRecommendations(
      auditResults.findings
    );

    // Calculate risk level
    const criticalFindings = auditResults.findings.filter(
      (f) => f.severity === "critical"
    );
    const highFindings = auditResults.findings.filter(
      (f) => f.severity === "high"
    );

    if (criticalFindings.length > 0) {
      auditResults.riskLevel = "critical";
    } else if (highFindings.length > 0) {
      auditResults.riskLevel = "high";
    } else if (auditResults.findings.length > 0) {
      auditResults.riskLevel = "medium";
    }

    // Store audit results
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `audits/${auditResults.auditId}.json`,
        Body: JSON.stringify(auditResults),
        ContentType: "application/json",
      })
    );

    return auditResults;
  }

  async checkVulnerabilities(payload: {
    projectId: string;
    repositoryUrl?: string;
  }): Promise<any> {
    console.log(`🛡️ Checking vulnerabilities for project ${payload.projectId}`);

    // TODO: Integrate with vulnerability scanning tools like:
    // - Snyk
    // - OWASP Dependency Check
    // - GitHub Security Advisory
    // - AWS Inspector

    const vulnerabilities = [
      {
        id: "vuln-001",
        severity: "high",
        title: "Outdated dependency with known vulnerability",
        description: "Package xyz@1.0.0 has a known security vulnerability",
        recommendation: "Update to xyz@1.2.3 or later",
        cve: "CVE-2023-12345",
      },
    ];

    const vulnResult = {
      projectId: payload.projectId,
      scanId: randomUUID(),
      scannedAt: new Date().toISOString(),
      vulnerabilities,
      summary: {
        critical: vulnerabilities.filter((v) => v.severity === "critical")
          .length,
        high: vulnerabilities.filter((v) => v.severity === "high").length,
        medium: vulnerabilities.filter((v) => v.severity === "medium").length,
        low: vulnerabilities.filter((v) => v.severity === "low").length,
      },
    };

    // Send alert for critical/high vulnerabilities
    if (vulnResult.summary.critical > 0 || vulnResult.summary.high > 0) {
      await this.createAlert(
        payload.projectId,
        "security",
        "critical",
        "Security vulnerabilities detected",
        vulnResult.summary
      );
    }

    return vulnResult;
  }

  private async checkGDPRCompliance(payload: any): Promise<any[]> {
    // TODO: Implement GDPR compliance checks
    return [
      {
        severity: "medium",
        description: "Privacy policy may need updates for GDPR compliance",
        recommendation:
          "Review and update privacy policy to include GDPR requirements",
        location: "/privacy-policy",
      },
    ];
  }

  private async checkSecurityCompliance(payload: any): Promise<any[]> {
    // TODO: Implement security compliance checks
    return [
      {
        severity: "high",
        description: "Weak password policy detected",
        recommendation: "Implement stronger password requirements",
        location: "authentication system",
      },
    ];
  }

  private async checkAccessibilityCompliance(payload: any): Promise<any[]> {
    // TODO: Implement accessibility compliance checks (WCAG)
    return [
      {
        severity: "medium",
        description: "Missing alt text on images",
        recommendation: "Add descriptive alt text to all images",
        location: "website images",
      },
    ];
  }

  // src/agents/monitoring-compliance.ts (continued)
  private async checkLicensingCompliance(payload: any): Promise<any[]> {
    // TODO: Check for license compatibility issues
    return [
      {
        severity: "low",
        description: "GPL dependency in commercial project",
        recommendation: "Review license compatibility for commercial use",
        location: "package dependencies",
      },
    ];
  }

  private async checkPerformanceMetrics(projectId: string): Promise<any> {
    // TODO: Integrate with CloudWatch or other monitoring tools
    return {
      averageResponseTime: 1200,
      p95ResponseTime: 2500,
      requestsPerSecond: 150,
      cpuUtilization: 45,
      memoryUtilization: 60,
    };
  }

  private async checkAvailabilityMetrics(projectId: string): Promise<any> {
    return {
      uptime: 99.95,
      downtime: 0.05,
      lastIncident: "2024-01-15T10:30:00Z",
      healthCheckSuccess: 99.8,
    };
  }

  private async checkErrorRateMetrics(projectId: string): Promise<any> {
    return {
      rate: 2.1,
      totalErrors: 150,
      totalRequests: 7500,
      errorTypes: {
        "4xx": 120,
        "5xx": 30,
      },
    };
  }

  private async checkResourceUsage(projectId: string): Promise<any> {
    return {
      storage: { used: 1.2, limit: 10, unit: "GB" },
      bandwidth: { used: 150, limit: 1000, unit: "GB" },
      apiCalls: { used: 50000, limit: 100000, unit: "calls" },
    };
  }

  private async createAlert(
    projectId: string,
    alertType: string,
    severity: string,
    message: string,
    details: any
  ): Promise<MonitoringAlert> {
    const alert: MonitoringAlert = {
      alertId: randomUUID(),
      projectId,
      alertType: alertType as any,
      severity: severity as any,
      message,
      details,
      triggeredAt: new Date().toISOString(),
      status: "active",
    };

    await this.storeAlert(alert);
    await this.sendAlert(alert);

    return alert;
  }

  private async auditSecurity(): Promise<any[]> {
    return [
      {
        finding: "Weak SSL/TLS configuration",
        severity: "high",
        description: "TLS 1.0 and 1.1 are still enabled",
        recommendation: "Disable TLS 1.0 and 1.1, use only TLS 1.2+",
        impact: "Man-in-the-middle attacks possible",
      },
      {
        finding: "Missing security headers",
        severity: "medium",
        description: "HSTS and CSP headers not configured",
        recommendation: "Implement proper security headers",
        impact: "XSS and clickjacking vulnerabilities",
      },
    ];
  }

  private async auditDataPrivacy(): Promise<any[]> {
    return [
      {
        finding: "Excessive data collection",
        severity: "medium",
        description: "Collecting more user data than necessary",
        recommendation: "Implement data minimization principles",
        impact: "Privacy compliance risk",
      },
    ];
  }

  private async auditAccessControl(): Promise<any[]> {
    return [
      {
        finding: "Overprivileged accounts",
        severity: "high",
        description: "Multiple accounts with unnecessary admin privileges",
        recommendation: "Implement principle of least privilege",
        impact: "Unauthorized access risk",
      },
    ];
  }

  private async generateAuditRecommendations(
    findings: any[]
  ): Promise<string[]> {
    const prompt = `
 Based on these audit findings, generate actionable recommendations:
 
 Findings:
 ${findings
   .map((f) => `- ${f.severity}: ${f.finding} - ${f.description}`)
   .join("\n")}
 
 Provide 5-7 specific, prioritized recommendations for addressing these security issues.
    `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0].text
      .split("\n")
      .filter((line: string) => line.trim());
  }

  private async getComplianceHistory(
    projectId: string,
    period: string
  ): Promise<ComplianceCheck[]> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.complianceTableName,
        IndexName: "projectId-checkedAt-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return (response.Items || []).map(
      (item) => unmarshall(item) as ComplianceCheck
    );
  }

  private async storeComplianceCheck(check: ComplianceCheck): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.complianceTableName,
        Item: marshall(check),
      })
    );
  }

  private async storeAlert(alert: MonitoringAlert): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.alertsTableName,
        Item: marshall(alert),
      })
    );
  }

  private async storeMetrics(projectId: string, metrics: any): Promise<void> {
    const timestamp = new Date();

    // Store in CloudWatch
    await this.cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: "ProjectIntelligence",
        MetricData: [
          {
            MetricName: "ResponseTime",
            Value: metrics.performance.averageResponseTime,
            Unit: "Milliseconds",
            Dimensions: [{ Name: "ProjectId", Value: projectId }],
            Timestamp: timestamp,
          },
          {
            MetricName: "Uptime",
            Value: metrics.availability.uptime,
            Unit: "Percent",
            Dimensions: [{ Name: "ProjectId", Value: projectId }],
            Timestamp: timestamp,
          },
          {
            MetricName: "ErrorRate",
            Value: metrics.errorRate.rate,
            Unit: "Percent",
            Dimensions: [{ Name: "ProjectId", Value: projectId }],
            Timestamp: timestamp,
          },
        ],
      })
    );
  }

  private async sendComplianceAlert(check: ComplianceCheck): Promise<void> {
    const message = {
      alertType: "compliance",
      projectId: check.projectId,
      checkType: check.checkType,
      status: check.status,
      criticalFindings: check.findings.filter((f) => f.severity === "critical")
        .length,
      timestamp: check.checkedAt,
    };

    await this.sns.send(
      new PublishCommand({
        TopicArn: this.alertTopicArn,
        Subject: `Compliance Alert - ${check.checkType} check failed`,
        Message: JSON.stringify(message),
      })
    );
  }

  private async sendAlert(alert: MonitoringAlert): Promise<void> {
    await this.sns.send(
      new PublishCommand({
        TopicArn: this.alertTopicArn,
        Subject: `${alert.severity.toUpperCase()} Alert - ${alert.alertType}`,
        Message: JSON.stringify({
          alertId: alert.alertId,
          projectId: alert.projectId,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          triggeredAt: alert.triggeredAt,
        }),
      })
    );
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
              agent: "monitoring-compliance",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
