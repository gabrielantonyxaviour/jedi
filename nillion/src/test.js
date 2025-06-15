"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchComplianceData = exports.pushComplianceData = void 0;
// compliance-manager.ts
var uuid_1 = require("uuid");
var nilql_1 = require("@nillion/nilql");
var did_jwt_1 = require("did-jwt");
var nillion_1 = require("./config/nillion");
// JWT Configuration - replace with your values
var SECRET_KEY = nillion_1.nillionConfig.orgCredentials.secretKey; // hex string of private key
var ORG_DID = nillion_1.nillionConfig.orgCredentials.orgDid;
var NODE_IDS = [
    nillion_1.nillionConfig.nodes[0].did,
    nillion_1.nillionConfig.nodes[1].did,
    nillion_1.nillionConfig.nodes[2].did,
];
var NODE_URLS = [
    nillion_1.nillionConfig.nodes[0].url,
    nillion_1.nillionConfig.nodes[1].url,
    nillion_1.nillionConfig.nodes[2].url,
];
var SCHEMA_ID = "e680560f-164e-4605-b1a4-885689164a95";
// Generate JWTs
function generateJWTs() {
    return __awaiter(this, void 0, void 0, function () {
        var signer, tokens, _i, NODE_IDS_1, nodeId, payload, token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    signer = (0, did_jwt_1.ES256KSigner)(Buffer.from(SECRET_KEY, "hex"));
                    tokens = [];
                    _i = 0, NODE_IDS_1 = NODE_IDS;
                    _a.label = 1;
                case 1:
                    if (!(_i < NODE_IDS_1.length)) return [3 /*break*/, 4];
                    nodeId = NODE_IDS_1[_i];
                    payload = {
                        iss: ORG_DID,
                        aud: nodeId,
                        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                    };
                    return [4 /*yield*/, (0, did_jwt_1.createJWT)(payload, { issuer: ORG_DID, signer: signer })];
                case 2:
                    token = _a.sent();
                    tokens.push(token);
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, tokens];
            }
        });
    });
}
// Initialize encryption service
function createEncryptionService() {
    return __awaiter(this, void 0, void 0, function () {
        var cluster, secretKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cluster = { nodes: Array(NODE_URLS.length).fill({}) };
                    return [4 /*yield*/, nilql_1.nilql.ClusterKey.generate(cluster, { store: true })];
                case 1:
                    secretKey = _a.sent();
                    return [2 /*return*/, {
                            encrypt: function (text) {
                                return __awaiter(this, void 0, void 0, function () {
                                    var shares;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, nilql_1.nilql.encrypt(secretKey, text)];
                                            case 1:
                                                shares = _a.sent();
                                                return [2 /*return*/, shares];
                                        }
                                    });
                                });
                            },
                            decrypt: function (shares) {
                                return __awaiter(this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, nilql_1.nilql.decrypt(secretKey, shares)];
                                            case 1: return [2 /*return*/, (_a.sent())];
                                        }
                                    });
                                });
                            },
                        }];
            }
        });
    });
}
// API functions
function uploadToNode(nodeIndex, record, jwt) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("".concat(NODE_URLS[nodeIndex], "/api/v1/data/create"), {
                            method: "POST",
                            headers: {
                                Authorization: "Bearer ".concat(jwt),
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                schema: SCHEMA_ID,
                                data: [record],
                            }),
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.ok];
                case 2:
                    error_1 = _a.sent();
                    console.error("Failed to upload to node ".concat(nodeIndex, ":"), error_1);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function fetchFromNode(nodeIndex, jwt) {
    return __awaiter(this, void 0, void 0, function () {
        var response, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(NODE_URLS[nodeIndex], "/api/v1/data/read"), {
                            method: "POST",
                            headers: {
                                Authorization: "Bearer ".concat(jwt),
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                schema: SCHEMA_ID,
                                filter: {},
                            }),
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    result = (_a.sent());
                    return [2 /*return*/, result.data || []];
                case 3:
                    error_2 = _a.sent();
                    console.error("Failed to fetch from node ".concat(nodeIndex, ":"), error_2);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Main functions
function pushComplianceData(data) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, encryption, jwts, recordId, _b, nameShares, sourceShares, dataShares, results;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        createEncryptionService(),
                        generateJWTs(),
                    ])];
                case 1:
                    _a = _c.sent(), encryption = _a[0], jwts = _a[1];
                    recordId = (0, uuid_1.v4)();
                    return [4 /*yield*/, Promise.all([
                            encryption.encrypt(data.name),
                            encryption.encrypt(data.source),
                            encryption.encrypt(data.data),
                        ])];
                case 2:
                    _b = _c.sent(), nameShares = _b[0], sourceShares = _b[1], dataShares = _b[2];
                    return [4 /*yield*/, Promise.all(NODE_URLS.map(function (_, index) {
                            return uploadToNode(index, {
                                _id: recordId,
                                name: { "%share": nameShares[index] },
                                source: { "%share": sourceShares[index] },
                                data: { "%share": dataShares[index] },
                            }, jwts[index]);
                        }))];
                case 3:
                    results = _c.sent();
                    return [2 /*return*/, results.every(Boolean)];
            }
        });
    });
}
exports.pushComplianceData = pushComplianceData;
function fetchComplianceData() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, encryption, jwts, allRecords, recordMap, decryptedRecords, _i, _b, entry, id, shares, _c, name_1, source, data, error_3;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        createEncryptionService(),
                        generateJWTs(),
                    ])];
                case 1:
                    _a = _d.sent(), encryption = _a[0], jwts = _a[1];
                    return [4 /*yield*/, Promise.all(NODE_URLS.map(function (_, index) { return fetchFromNode(index, jwts[index]); }))];
                case 2:
                    allRecords = _d.sent();
                    recordMap = new Map();
                    allRecords.flat().forEach(function (record) {
                        if (!recordMap.has(record._id)) {
                            recordMap.set(record._id, {
                                nameShares: [],
                                sourceShares: [],
                                dataShares: [],
                            });
                        }
                        var entry = recordMap.get(record._id);
                        entry.nameShares.push(record.name["%share"]);
                        entry.sourceShares.push(record.source["%share"]);
                        entry.dataShares.push(record.data["%share"]);
                    });
                    decryptedRecords = [];
                    _i = 0, _b = Array.from(recordMap.entries());
                    _d.label = 3;
                case 3:
                    if (!(_i < _b.length)) return [3 /*break*/, 8];
                    entry = _b[_i];
                    id = entry[0], shares = entry[1];
                    if (!(shares.nameShares.length === NODE_URLS.length)) return [3 /*break*/, 7];
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, Promise.all([
                            encryption.decrypt(shares.nameShares),
                            encryption.decrypt(shares.sourceShares),
                            encryption.decrypt(shares.dataShares),
                        ])];
                case 5:
                    _c = _d.sent(), name_1 = _c[0], source = _c[1], data = _c[2];
                    decryptedRecords.push({ name: name_1, source: source, data: data });
                    return [3 /*break*/, 7];
                case 6:
                    error_3 = _d.sent();
                    console.error("Failed to decrypt record ".concat(id, ":"), error_3);
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8: return [2 /*return*/, decryptedRecords];
            }
        });
    });
}
exports.fetchComplianceData = fetchComplianceData;
// Example usage
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var success, records;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pushComplianceData({
                        name: "GDPR Compliance Report",
                        source: "EU Data Protection Officer",
                        data: "All customer data properly anonymized and stored according to GDPR requirements.",
                    })];
                case 1:
                    success = _a.sent();
                    console.log(success ? "✓ Data pushed" : "✗ Push failed");
                    return [4 /*yield*/, fetchComplianceData()];
                case 2:
                    records = _a.sent();
                    console.log("Records:", records);
                    return [2 /*return*/];
            }
        });
    });
}
if (require.main === module) {
    main().catch(console.error);
}
