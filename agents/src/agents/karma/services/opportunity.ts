import { KarmaSDKService } from "./karma";
import { KarmaProject } from "./project";

export interface Opportunity {
  communityUID: string;
  communityName: string;
  grantUID: string;
  grantTitle: string;
  grantDescription: string;
  deadline?: number;
  amount?: number;
  requirements: string[];
}

export class OpportunityService {
  constructor(private karmaSDK: KarmaSDKService) {}

  async getGrantOpportunities(): Promise<Opportunity[]> {
    return await this.karmaSDK.fetchGrantOpportunities();
  }

  async getCommunities(): Promise<Array<{ uid: string; name: string }>> {
    const opportunities = await this.karmaSDK.fetchGrantOpportunities();
    // Extract unique communities
    const uniqueCommunities = opportunities.reduce((acc, opportunity) => {
      if (!acc.find((c: any) => c.uid === opportunity.communityUID)) {
        acc.push({
          uid: opportunity.communityUID,
          name: opportunity.communityName,
        });
      }
      return acc;
    }, [] as Array<{ uid: string; name: string }>);
    return uniqueCommunities;
  }

  async getProjects(): Promise<any[]> {
    return await this.karmaSDK.fetchProjects();
  }

  async isOpportunityRelevant(
    project: KarmaProject,
    opportunity: Opportunity
  ): Promise<boolean> {
    // Check if project already has a grant for this opportunity
    const hasGrant = project.grants.some(
      (grant) => grant.uid === opportunity.grantUID
    );
    if (hasGrant) return false;

    // Check if project matches opportunity requirements
    const projectKeywords = this.extractKeywords(project.description);
    const opportunityKeywords = this.extractKeywords(
      opportunity.grantDescription
    );

    // Check for keyword overlap
    const matchingKeywords = projectKeywords.filter((keyword) =>
      opportunityKeywords.includes(keyword)
    );

    // Consider it relevant if there's at least 30% keyword match
    const matchPercentage =
      matchingKeywords.length /
      Math.max(projectKeywords.length, opportunityKeywords.length);
    return matchPercentage >= 0.3;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - split by spaces and remove common words
    const commonWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "with",
      "by",
      "a",
      "an",
      "of",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !commonWords.has(word));
  }
}
