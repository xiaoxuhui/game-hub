"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retiredCampaignLevelIds = exports.MAX_CAMPAIGN_DRAFT_LENGTH = void 0;
// Large generated examples (notably λ reduction) need more room than a short hand-written exercise.
exports.MAX_CAMPAIGN_DRAFT_LENGTH = 8_000_000;
// Accept historical backups while dropping only exercises explicitly retired from the curriculum.
exports.retiredCampaignLevelIds = new Set([
    "example-beaver", "example-beaver3Steps", "example-beaver3Ones", "example-beaver4", "example-beaver23", "example-beaver24",
    "example-registerAdder", "example-fibonacci",
]);
