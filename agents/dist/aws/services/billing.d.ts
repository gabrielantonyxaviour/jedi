import { CreditConsumption, PaymentRecord, ProjectFinancials } from "../types/billing";
export declare class BillingService {
    private dynamoClient;
    private readonly AWS_COSTS;
    constructor();
    recordCreditConsumption(consumption: Omit<CreditConsumption, "consumptionId" | "timestamp">): Promise<void>;
    recordGitHubAnalysis(projectKey: string, repoUrl: string, workflowId?: string): Promise<void>;
    recordWebhookProcessing(projectKey: string, repoName: string, commitsCount: number): Promise<void>;
    recordBulkAnalysis(projectKey: string, repoCount: number, workflowId?: string): Promise<void>;
    recordProjectLaunchWorkflow(projectKey: string, enabledAgents: string[], workflowId?: string): Promise<void>;
    recordSocialMediaCampaign(projectKey: string, platforms: string[], postsCount: number): Promise<void>;
    recordEmailOutreach(projectKey: string, emailCount: number, templateGeneration?: boolean): Promise<void>;
    recordBlockchainOperation(projectKey: string, operation: string, gasEstimate?: string): Promise<void>;
    recordPayment(payment: Omit<PaymentRecord, "paymentId" | "timestamp">): Promise<void>;
    getProjectFinancials(projectKey: string): Promise<ProjectFinancials | null>;
    getProjectPayments(projectKey: string, limit?: number): Promise<PaymentRecord[]>;
    getCreditConsumptions(projectKey: string, fromDate?: string, toDate?: string, limit?: number): Promise<CreditConsumption[]>;
    private storeCreditConsumption;
    private storePaymentRecord;
    private updateProjectFinancials;
    generateProjectKey(projectName: string): string;
    getTopConsumingProjects(limit?: number): Promise<Array<{
        projectKey: string;
        totalConsumed: number;
    }>>;
    getConsumptionsByAgent(projectKey: string, agentName: string): Promise<CreditConsumption[]>;
    formatCurrency(amount: number): string;
}
