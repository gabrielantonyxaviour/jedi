import { LogsService } from "./logs-service";
import { GithubService } from "./github-service";
import { LeadsService } from "./leads-service";
import { StoriesService } from "./stories-service";
import { SocialsService } from "./socials-service";
import { GrantsService } from "./grants-service";
import { ComplianceService } from "./compliance-service";

export class ServiceFactory {
  private static instances: Map<string, any> = new Map();

  static getLogs(): LogsService {
    if (!this.instances.has("logs")) {
      this.instances.set("logs", new LogsService());
    }
    return this.instances.get("logs");
  }

  static getGithub(): GithubService {
    if (!this.instances.has("github")) {
      this.instances.set("github", new GithubService());
    }
    return this.instances.get("github");
  }

  static getLeads(): LeadsService {
    if (!this.instances.has("leads")) {
      this.instances.set("leads", new LeadsService());
    }
    return this.instances.get("leads");
  }

  static getStories(): StoriesService {
    if (!this.instances.has("stories")) {
      this.instances.set("stories", new StoriesService());
    }
    return this.instances.get("stories");
  }

  static getSocials(): SocialsService {
    if (!this.instances.has("socials")) {
      this.instances.set("socials", new SocialsService());
    }
    return this.instances.get("socials");
  }

  static getGrants(): GrantsService {
    if (!this.instances.has("grants")) {
      this.instances.set("grants", new GrantsService());
    }
    return this.instances.get("grants");
  }

  static getCompliance(): ComplianceService {
    if (!this.instances.has("compliance")) {
      this.instances.set("compliance", new ComplianceService());
    }
    return this.instances.get("compliance");
  }
}

export {
  LogsService,
  GithubService,
  LeadsService,
  StoriesService,
  SocialsService,
  GrantsService,
  ComplianceService,
};
