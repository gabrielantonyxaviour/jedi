import { AgentName } from "../types/index.js";

export class Validators {
  static isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidAgentName(name: string): name is AgentName {
    const validAgents: AgentName[] = [
      "github",
      "leads",
      "socials",
      "karma",
      "ip",
      "compliance",
      "orchestrator",
    ];
    return validAgents.includes(name as AgentName);
  }

  static isValidLicenseTerms(terms: string): boolean {
    return terms === "commercial" || terms === "non-commercial";
  }

  static isValidTwitterAction(action: string): boolean {
    const validActions = ["tweet", "reply", "like", "retweet", "quote"];
    return validActions.includes(action);
  }

  static isValidLinkedinAction(action: string): boolean {
    const validActions = ["post", "reply", "like", "repost", "quote"];
    return validActions.includes(action);
  }

  static validateRequiredFields(
    obj: Record<string, any>,
    requiredFields: string[]
  ): string[] {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (
        obj[field] === undefined ||
        obj[field] === null ||
        obj[field] === ""
      ) {
        missingFields.push(field);
      }
    }

    return missingFields;
  }

  static sanitizeString(str: string, maxLength: number = 1000): string {
    if (typeof str !== "string") return "";

    return str
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .replace(/javascript:/gi, ""); // Remove javascript: protocols
  }

  static validateMetadata(metadata: Record<string, any>): boolean {
    try {
      JSON.stringify(metadata);
      return true;
    } catch {
      return false;
    }
  }
}
