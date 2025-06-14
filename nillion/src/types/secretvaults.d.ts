declare module "secretvaults" {
  interface Node {
    url: string;
    did: string;
  }

  interface OrgCredentials {
    secretKey: string;
    orgDid: string;
  }

  interface WriteResult {
    data: {
      created: string[];
      errors?: Array<{
        error: string;
        document: any;
      }>;
    };
  }

  export class SecretVaultWrapper {
    constructor(
      nodes: Node[],
      orgCredentials: OrgCredentials,
      schemaId: string
    );

    init(): Promise<void>;

    writeToNodes(data: any[]): Promise<WriteResult[]>;

    readFromNodes(filter?: Record<string, any>): Promise<any[]>;

    updateFromNodes(id: string, data: any): Promise<void>;

    deleteFromNodes(id: string): Promise<void>;
  }
}

declare module "secretvaults/index.js" {
  export class SecretVaultWrapper {
    constructor(nodes: any, credentials: any, schemaId: string);
    init(): Promise<void>;
    writeToNodes(data: any[]): Promise<any>;
    readFromNodes(filter: any): Promise<any[]>;
    updateFromNodes(id: string, data: any): Promise<void>;
    deleteFromNodes(id: string): Promise<void>;
  }
}
