// app/api/tweet/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function GET(request: NextRequest) {
  console.log("📝 Preparing tweet content...");
  const tweetText = `🚀 Just took over the Jedi AI Framework - a TypeScript chat system where agent servers do the heavy lifting so humans can just... chat 

5.8MB of "how hard could real-time messaging be?" energy ⚡

Welcome to the repo where we're basically building Slack but with more lightsabers 🗡️

#TypeScript #AI #OpenSource`;

  try {
    console.log("🔑 Initializing Twitter client...");

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    console.log("🐦 Posting tweet...");
    const tweet = await client.v2.tweet(tweetText);
    console.log("✅ Tweet posted successfully:", tweet.data.id);

    const tweetUrl = `https://twitter.com/${process.env.TWITTER_USERNAME}/status/${tweet.data.id}`;
    console.log("🔗 Tweet URL:", tweetUrl);

    return NextResponse.json({
      success: true,
      tweet: tweet,
      url: tweetUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to post tweet",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
