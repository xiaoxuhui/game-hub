"use strict";
// 测试替身：真实实现依赖 IndexedDB 与 import.meta.env，Node 夹具只提供空操作。
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueArchive = function queueArchive() {};
exports.archiveError = function archiveError() { return ""; };
