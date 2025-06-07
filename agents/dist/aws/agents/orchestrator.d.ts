export declare class CoreOrchestratorAgent {
    private sqsClient;
    private dynamoClient;
    private eventBridgeClient;
    private stepFunctionsClient;
    private app;
    private billingService;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private sendTaskToAgent;
    private sendSyncTaskToAgent;
    private publishEvent;
    private startStepFunctionWorkflow;
    private storeWorkflow;
    private getWorkflow;
    private storeTaskStatus;
    private getTaskStatus;
    private getUserWorkflows;
    private getAgentStatus;
    private getAgentQueueUrl;
    private getTopActions;
    private getAgentBreakdown;
    start(port?: number): void;
}
