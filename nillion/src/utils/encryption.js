"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const nilql_1 = require("@nillion/nilql");
const nillion_js_1 = require("../config/nillion.js");
class EncryptionService {
    constructor() {
        this.initialized = false;
    }
    async init() {
        if (!this.initialized) {
            const cluster = {
                nodes: nillion_js_1.nillionConfig.nodes.map((node) => ({
                    url: node.url,
                    did: node.did,
                })),
            };
            this.secretKey = await nilql_1.nilql.ClusterKey.generate(cluster, {
                store: true,
                match: true,
                sum: true,
            });
            this.initialized = true;
        }
    }
    async encryptForStorage(data) {
        await this.init();
        const shares = await nilql_1.nilql.encrypt(this.secretKey, data);
        return Array.isArray(shares) ? shares : [shares];
    }
    async decryptFromStorage(shares) {
        await this.init();
        const decrypted = await nilql_1.nilql.decrypt(this.secretKey, shares);
        return decrypted;
    }
    async encryptForSum(value) {
        await this.init();
        const shares = await nilql_1.nilql.encrypt(this.secretKey, value);
        return Array.isArray(shares) ? shares : [shares];
    }
    async decryptSum(shares) {
        await this.init();
        const decrypted = await nilql_1.nilql.decrypt(this.secretKey, shares);
        return Number(decrypted);
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
