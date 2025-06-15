"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_js_1 = require("../services/index.js");
async function testSocials() {
    console.log("🧪 Testing Socials Service...\n");
    const socialsService = index_js_1.ServiceFactory.getSocials();
    try {
        // Create test social accounts
        console.log("📝 Creating test social accounts...");
        const twitterId = await socialsService.createTwitterAccount("ai_startup_bot", "bot@aistartup.com", "super_secret_password_123");
        const telegramId = await socialsService.createTelegramBot("BlockchainNewsBot", "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ123456789");
        console.log(`✅ Created social accounts: Twitter=${twitterId}, Telegram=${telegramId}\n`);
        // Add Twitter actions
        console.log("🐦 Adding Twitter actions...");
        await socialsService.addTwitterAction(twitterId, "tweet", "Just launched our new AI-powered analytics platform! 🚀 #AI #Analytics #Tech");
        await socialsService.addTwitterAction(twitterId, "retweet", "Great insights on the future of AI!", "tweet_123456");
        await socialsService.addTwitterAction(twitterId, "reply", "Thanks for sharing! We completely agree with your perspective.", "tweet_789012");
        // Add Telegram messages
        console.log("💬 Adding Telegram messages...");
        await socialsService.addTelegramMessage(telegramId, "user_001", "What are the latest blockchain trends?");
        await socialsService.addTelegramMessage(telegramId, "user_002", "Can you explain DeFi protocols?");
        await socialsService.addTelegramMessage(telegramId, "user_003", "What is the future of NFTs?");
        // Read social accounts
        console.log("\n📖 Reading social accounts...");
        const allSocials = await socialsService.findAll();
        console.log(`📊 Total social accounts: ${allSocials.length}`);
        // Display sample social account
        if (allSocials.length > 0) {
            console.log("\n📄 Sample social account:");
            const social = allSocials[0];
            if (social.twitter) {
                console.log(`  Twitter Username: ${social.twitter.username}`);
                console.log(`  Twitter Actions: ${social.twitter.actions.length}`);
                if (social.twitter.actions.length > 0) {
                    const action = social.twitter.actions[0];
                    console.log(`    Latest Action: ${action.action} - "${action.text}"`);
                }
            }
            if (social.telegram) {
                console.log(`  Telegram Bot: ${social.telegram.botusername}`);
                console.log(`  Messages: ${social.telegram.messages.length}`);
                if (social.telegram.messages.length > 0) {
                    const message = social.telegram.messages[0];
                    console.log(`    Latest Message: "${message.text}" from ${message.user_id}`);
                }
            }
        }
        console.log("\n✅ Socials service test completed successfully!");
    }
    catch (error) {
        console.error("❌ Socials service test failed:", error);
        process.exit(1);
    }
}
testSocials();
