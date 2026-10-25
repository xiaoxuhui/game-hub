"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CAMPAIGN_BACKUP_BYTES = void 0;
exports.encodeCampaignBackup = encodeCampaignBackup;
exports.parseCampaignBackup = parseCampaignBackup;
const campaign_1 = require("./campaign.cjs");
exports.MAX_CAMPAIGN_BACKUP_BYTES = 1_048_576;
const FORMAT = "turing-machine-campaign";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateProgress(value) {
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.completedLevelIds) || !isRecord(value.drafts)) {
        throw new Error("存档缺少有效的关卡进度或规则草稿。");
    }
    const knownIds = new Set(campaign_1.campaignLevels.map((level) => level.id));
    const completed = value.completedLevelIds;
    if (completed.length > knownIds.size || completed.some((id) => typeof id !== "string" || !knownIds.has(id)) || new Set(completed).size !== completed.length) {
        throw new Error("存档包含未知或重复的已通关关卡。");
    }
    const drafts = Object.entries(value.drafts);
    if (drafts.length > knownIds.size || drafts.some(([id, rules]) => !knownIds.has(id) || typeof rules !== "string" || rules.length > 100_000)) {
        throw new Error("存档包含无效的规则草稿。");
    }
    return {
        version: 1,
        completedLevelIds: [...completed],
        drafts: Object.fromEntries(drafts),
    };
}
function encodeCampaignBackup(progress, exportedAt = new Date()) {
    const backup = {
        format: FORMAT,
        version: 1,
        exportedAt: exportedAt.toISOString(),
        progress: validateProgress(progress),
    };
    return `${JSON.stringify(backup, null, 2)}\n`;
}
function parseCampaignBackup(source) {
    if (new TextEncoder().encode(source).byteLength > exports.MAX_CAMPAIGN_BACKUP_BYTES) {
        throw new Error("存档文件超过 1 MiB。");
    }
    let value;
    try {
        value = JSON.parse(source);
    }
    catch {
        throw new Error("存档不是有效的 JSON 文件。");
    }
    if (!isRecord(value) || value.format !== FORMAT || value.version !== 1 || typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
        throw new Error("存档格式或版本不受支持。");
    }
    return validateProgress(value.progress);
}
