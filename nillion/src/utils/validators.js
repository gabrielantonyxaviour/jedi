"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validators = void 0;
class Validators {
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static isValidURL(url) {
        try {
            new URL(url);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    static isValidAgentName(name) {
        const validAgents = [
            "github",
            "leads",
            "socials",
            "karma",
            "ip",
            "compliance",
            "orchestrator",
        ];
        return validAgents.includes(name);
    }
    static isValidLicenseTerms(terms) {
        return terms === "commercial" || terms === "non-commercial";
    }
    static isValidTwitterAction(action) {
        const validActions = ["tweet", "reply", "like", "retweet", "quote"];
        return validActions.includes(action);
    }
    static isValidLinkedinAction(action) {
        const validActions = ["post", "reply", "like", "repost", "quote"];
        return validActions.includes(action);
    }
    static validateRequiredFields(obj, requiredFields) {
        const missingFields = [];
        for (const field of requiredFields) {
            if (obj[field] === undefined ||
                obj[field] === null ||
                obj[field] === "") {
                missingFields.push(field);
            }
        }
        return missingFields;
    }
    static sanitizeString(str, maxLength = 1000) {
        if (typeof str !== "string")
            return "";
        return str
            .trim()
            .slice(0, maxLength)
            .replace(/[<>]/g, "") // Remove potential HTML tags
            .replace(/javascript:/gi, ""); // Remove javascript: protocols
    }
    static validateMetadata(metadata) {
        try {
            JSON.stringify(metadata);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.Validators = Validators;
