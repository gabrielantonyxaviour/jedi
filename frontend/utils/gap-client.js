import { GAP } from "@show-karma/karma-gap-sdk";
import { GapIndexerClient } from "@show-karma/karma-gap-sdk/core/class";

const client = new GAP({
  globalSchemas: false,
  network: "optimism-sepolia", // can be any of our supported networks. you can check here -> https://github.com/show-karma/karma-gap-sdk/blob/main/core/types.ts#L80
  apiClient: new GapIndexerClient("https://gapapi.karmahq.xyz"), // custom api client, see Section 8;
});

export default client;
