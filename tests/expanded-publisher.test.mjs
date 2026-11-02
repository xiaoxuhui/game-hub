import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/publish-expanded-bootstrap.ps1',import.meta.url));
test('bootstrap publisher rejects malformed identities and unsafe evidence paths before network', {skip:process.platform!=='win32'},()=>{
 const shell=process.env.GAME_HUB_PWSH||'pwsh.exe',run=args=>spawnSync(shell,['-NoProfile','-NonInteractive','-File',script,...args],{encoding:'utf8'}),commit='a'.repeat(40),sha='b'.repeat(64),valid=['-Commit',commit,'-ExpectedLegacySha',sha];
 const badCommit=run(['-Commit','main','-ExpectedLegacySha',sha,'-EvidenceDirectory','D:\\aiden\\game-hub-expanded-evidence-20261101\\bad']);assert.notEqual(badCommit.status,0);assert.match(badCommit.stderr,/Exact commit and legacy digest required/);
 const badSha=run(['-Commit',commit,'-ExpectedLegacySha','bad','-EvidenceDirectory','D:\\aiden\\game-hub-expanded-evidence-20261101\\bad']);assert.notEqual(badSha.status,0);assert.match(badSha.stderr,/Exact commit and legacy digest required/);
 const badPath=run([...valid,'-EvidenceDirectory','D:\\aiden\\outside']);assert.notEqual(badPath.status,0);assert.match(badPath.stderr,/Fresh task evidence subdirectory required/);
});
