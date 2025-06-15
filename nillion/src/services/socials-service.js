"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialsService = void 0;
const base_service_js_1 = require("./base-service.js");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class SocialsService extends base_service_js_1.BaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.SOCIALS);
    }
    async createTwitterAccount(username, email, password) {
        const social = {
            _id: (0, uuid_1.v4)(),
            twitter: {
                username,
                email: { "%allot": email },
                password: { "%allot": password },
                actions: [],
            },
        };
        console.log("Sending data:", JSON.stringify(social, null, 2)); // Debug log
        const ids = await this.create([social]);
        return ids[0];
    }
    async createTelegramBot(botusername, bot_token) {
        const social = {
            _id: (0, uuid_1.v4)(), // Changed from 'id'
            telegram: {
                botusername,
                bot_token: { "%allot": bot_token },
                messages: [],
            },
        };
        const ids = await this.create([social]);
        return ids[0];
    }
    async addTwitterAction(socialId, action, text, ref_id) {
        const social = await this.findById(socialId);
        if (!social || !social.twitter)
            return false;
        const newAction = {
            id: (0, uuid_1.v4)(),
            action,
            text,
            ref_id,
        };
        console.log(social);
        social.twitter.actions.push(newAction);
        return await this.update(socialId, social);
    }
    async addTelegramMessage(socialId, user_id, text) {
        const social = await this.findById(socialId);
        if (!social || !social.telegram)
            return false;
        const newMessage = {
            id: (0, uuid_1.v4)(),
            user_id,
            text,
        };
        console.log(social);
        social.telegram.messages.push(newMessage);
        return await this.update(socialId, social);
    }
    // Analytics
    async getTwitterActionStats() {
        const pipeline = [
            {
                $match: { twitter: { $exists: true } },
            },
            {
                $unwind: "$twitter.actions",
            },
            {
                $group: {
                    _id: "$twitter.actions.action",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
        ];
        return await this.query(pipeline);
    }
    async getTelegramMessageVolume() {
        const pipeline = [
            {
                $match: { telegram: { $exists: true } },
            },
            {
                $project: {
                    botusername: "$telegram.botusername",
                    messageCount: { $size: "$telegram.messages" },
                },
            },
            {
                $sort: { messageCount: -1 },
            },
        ];
        return await this.query(pipeline);
    }
}
exports.SocialsService = SocialsService;
