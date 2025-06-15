"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_IDS = exports.nillionConfig = void 0;
// src/config/nillion.ts
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
exports.nillionConfig = {
    orgCredentials: {
        secretKey: process.env.NILLION_SECRET_KEY,
        orgDid: process.env.NILLION_ORG_DID,
    },
    nodes: [
        {
            url: "https://nildb-nx8v.nillion.network",
            did: "did:nil:testnet:nillion1qfrl8nje3nvwh6cryj63mz2y6gsdptvn07nx8v",
        },
        {
            url: "https://nildb-p3mx.nillion.network",
            did: "did:nil:testnet:nillion1uak7fgsp69kzfhdd6lfqv69fnzh3lprg2mp3mx",
        },
        {
            url: "https://nildb-rugk.nillion.network",
            did: "did:nil:testnet:nillion1kfremrp2mryxrynx66etjl8s7wazxc3rssrugk",
        },
    ],
};
exports.SCHEMA_IDS = {
    LOGS: process.env.LOGS_SCHEMA_ID,
    GITHUB: process.env.GITHUB_SCHEMA_ID,
    LEADS: process.env.LEADS_SCHEMA_ID,
    STORIES: process.env.STORIES_SCHEMA_ID,
    SOCIALS: process.env.SOCIALS_SCHEMA_ID,
    GRANTS: process.env.GRANTS_SCHEMA_ID,
    COMPLIANCE: process.env.COMPLIANCE_SCHEMA_ID,
};
