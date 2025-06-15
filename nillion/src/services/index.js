"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceService = exports.GrantsService = exports.SocialsService = exports.StoriesService = exports.LeadsService = exports.GithubService = exports.LogsService = exports.ServiceFactory = void 0;
const logs_service_js_1 = require("./logs-service.js");
Object.defineProperty(exports, "LogsService", { enumerable: true, get: function () { return logs_service_js_1.LogsService; } });
const github_service_js_1 = require("./github-service.js");
Object.defineProperty(exports, "GithubService", { enumerable: true, get: function () { return github_service_js_1.GithubService; } });
const leads_service_js_1 = require("./leads-service.js");
Object.defineProperty(exports, "LeadsService", { enumerable: true, get: function () { return leads_service_js_1.LeadsService; } });
const stories_service_js_1 = require("./stories-service.js");
Object.defineProperty(exports, "StoriesService", { enumerable: true, get: function () { return stories_service_js_1.StoriesService; } });
const socials_service_js_1 = require("./socials-service.js");
Object.defineProperty(exports, "SocialsService", { enumerable: true, get: function () { return socials_service_js_1.SocialsService; } });
const grants_service_js_1 = require("./grants-service.js");
Object.defineProperty(exports, "GrantsService", { enumerable: true, get: function () { return grants_service_js_1.GrantsService; } });
const compliance_service_js_1 = require("./compliance-service.js");
Object.defineProperty(exports, "ComplianceService", { enumerable: true, get: function () { return compliance_service_js_1.ComplianceService; } });
class ServiceFactory {
    static getLogs() {
        if (!this.instances.has("logs")) {
            this.instances.set("logs", new logs_service_js_1.LogsService());
        }
        return this.instances.get("logs");
    }
    static getGithub() {
        if (!this.instances.has("github")) {
            this.instances.set("github", new github_service_js_1.GithubService());
        }
        return this.instances.get("github");
    }
    static getLeads() {
        if (!this.instances.has("leads")) {
            this.instances.set("leads", new leads_service_js_1.LeadsService());
        }
        return this.instances.get("leads");
    }
    static getStories() {
        if (!this.instances.has("stories")) {
            this.instances.set("stories", new stories_service_js_1.StoriesService());
        }
        return this.instances.get("stories");
    }
    static getSocials() {
        if (!this.instances.has("socials")) {
            this.instances.set("socials", new socials_service_js_1.SocialsService());
        }
        return this.instances.get("socials");
    }
    static getGrants() {
        if (!this.instances.has("grants")) {
            this.instances.set("grants", new grants_service_js_1.GrantsService());
        }
        return this.instances.get("grants");
    }
    static getCompliance() {
        if (!this.instances.has("compliance")) {
            this.instances.set("compliance", new compliance_service_js_1.ComplianceService());
        }
        return this.instances.get("compliance");
    }
}
exports.ServiceFactory = ServiceFactory;
ServiceFactory.instances = new Map();
