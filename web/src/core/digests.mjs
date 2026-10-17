import {sha256} from '../vendor/noble-hashes/sha2.js';
const encode=text=>new TextEncoder().encode(text);
export const sha256Hex=bytes=>Array.from(sha256(typeof bytes==='string'?encode(bytes):bytes),b=>b.toString(16).padStart(2,'0')).join('');
export function canonicalFiles(files){return files.map(f=>({path:f.path,bytes:f.bytes,sha256:f.sha256,mime:f.mime})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
export const fileTreeDigest=files=>sha256Hex(JSON.stringify(canonicalFiles(files)));
export const sourceProofBytes=game=>encode(JSON.stringify({schemaVersion:1,gameId:game.id,repository:game.sourceRepository,revision:game.sourceRevision,files:canonicalFiles(game.sourceFiles)})+'\n');
