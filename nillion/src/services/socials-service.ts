import { BaseService } from "./base-service";
import {
  Social,
  TwitterAction,
  LinkedinAction,
  TelegramMessage,
} from "../types";
import { SCHEMA_IDS } from "../config/nillion";
import { v4 as uuidv4 } from "uuid";
import { nilql } from "@nillion/nilql";

export class SocialsService extends BaseService<Social> {
  constructor() {
    super(SCHEMA_IDS.SOCIALS);
  }

  async createTwitterAccount(
    username: string,
    email: string,
    password: string
  ): Promise<string> {
    // Encrypt sensitive data
    const social: Social = {
      id: uuidv4(),
      twitter: {
        username,
        email: { "%allot": email },
        password: { "%allot": password },
        actions: [],
      },
    };

    const ids = await this.create([social]);
    return ids[0];
  }

  async addTwitterAction(
    socialId: string,
    action: TwitterAction["action"],
    text: string,
    ref_id?: string
  ): Promise<boolean> {
    const social = await this.findById(socialId);
    if (!social || !social.twitter) return false;

    const newAction: TwitterAction = {
      id: uuidv4(),
      action,
      text,
      ref_id,
    };

    social.twitter.actions.push(newAction);
    return await this.update(socialId, social);
  }

  async createTelegramBot(
    botusername: string,
    bot_token: string
  ): Promise<string> {
    const social: Social = {
      id: uuidv4(),
      telegram: {
        botusername,
        bot_token: { "%allot": bot_token },
        messages: [],
      },
    };

    const ids = await this.create([social]);
    return ids[0];
  }

  async addTelegramMessage(
    socialId: string,
    user_id: string,
    text: string
  ): Promise<boolean> {
    const social = await this.findById(socialId);
    if (!social || !social.telegram) return false;

    const newMessage: TelegramMessage = {
      id: uuidv4(),
      user_id,
      text,
    };

    social.telegram.messages.push(newMessage);
    return await this.update(socialId, social);
  }

  // Analytics
  async getTwitterActionStats(): Promise<any[]> {
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

  async getTelegramMessageVolume(): Promise<any[]> {
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
