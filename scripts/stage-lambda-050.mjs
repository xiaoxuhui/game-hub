import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './resource-protocol.mjs';
import {inspectResources} from './resource-bundle.mjs';
import {integrateLambdaC5Html,lambdaC5IntegrationProof} from './lambda-040-storage-integration.mjs';
import {protectLambda037} from './lambda-040-037-protection.mjs';
import {preserveLambdaSessions} from './lambda-preserve-sessions.mjs';
import {fixLambdaExportRoundTrip} from './lambda-export-roundtrip.mjs';
import {fixLambdaLargeArchive} from './lambda-large-archive.mjs';
import {quotaReadonly} from './lambda-quota-readonly.mjs';

// Stage the Lambda 0.5.0 hall resource: replay the reviewed protection chain on
// the 0.5.0 build and record every adapter identity in the source proof.
const source=resolve(process.argv[2]||'D:/soft/lambda-diagram-game');
const gameHub=fileURLToPath(new URL('../',import.meta.url));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,maxBuffer:40*1024*1024});
const revision=git(source,'rev-parse','HEAD').toString().trim(),repository='https://github.com/xiaoxuhui/lambda-diagram-game.git';
if(git(source,'status','--porcelain=v1','--untracked-files=all').toString())throw Error('Clean Lambda checkout required');
if(git(source,'remote','get-url','origin').toString().trim()!==repository)throw Error('Wrong Lambda remote');
const pkg=JSON.parse(git(source,'show',`${revision}:package.json`));if(pkg.version!=='0.5.0')throw Error('Expected Lambda 0.5.0');
const paths=git(source,'ls-tree','-r','--name-only',revision).toString().trim().split(/\r?\n/).filter(p=>/^(?:LICENSE|index\.html|package\.json|scripts\/build(?:-guide-names\.cjs|\.mjs)|src\/.*)$/.test(p)).sort();
const inputs=paths.map(path=>{const data=git(source,'show',`${revision}:${path}`);if(!data.equals(readFileSync(join(source,path))))throw Error('Changed upstream input '+path);return {path,bytes:data.length,sha256:sha256(data)};});
const upstream=git(source,'show',`${revision}:dist/lambda-lab.html`),license=git(source,'show',`${revision}:LICENSE`);
if(!upstream.equals(readFileSync(join(source,'dist/lambda-lab.html'))))throw Error('Tracked Lambda output differs');
const integrated=integrateLambdaC5Html(upstream);
const protectedHtml=protectLambda037(integrated.toString('utf8'));
const preserved=preserveLambdaSessions(protectedHtml);
const roundTrip=fixLambdaExportRoundTrip(preserved);
const recovered=fixLambdaLargeArchive(roundTrip);
const output=Buffer.from(quotaReadonly(recovered));
const sourceCommit=git(gameHub,'rev-parse','HEAD').toString().trim();
const proof={schemaVersion:1,id:'lambda-diagram-game',repository,revision,version:pkg.version,buildKind:'inline-html',entryPage:'lambda-lab.html',inputs,
  outputs:[{path:'LICENSE',bytes:license.length,sha256:sha256(license)},{path:'lambda-lab.html',bytes:integrated.length,sha256:sha256(integrated)}],
  trackedArtifact:{path:'dist/lambda-lab.html',bytes:upstream.length,sha256:sha256(upstream),matchesRebuild:true},adaptation:lambdaC5IntegrationProof(upstream,integrated)};
const metadata={...proof,
  hallProtection:{id:'lambda-040-recovery-v1',sessionArchiveAdapterSha256:sha256(readFileSync('scripts/lambda-preserve-sessions.mjs')),exportRoundTripAdapterSha256:sha256(readFileSync('scripts/lambda-export-roundtrip.mjs')),inputSha256:sha256(integrated),outputSha256:sha256(Buffer.from(roundTrip)),adapterSha256:sha256(readFileSync('scripts/lambda-040-037-protection.mjs')),baseAdapterSha256:sha256(readFileSync('scripts/lambda-040-30s-protection.mjs')),historyGuardSha256:sha256(readFileSync('scripts/lambda-long-history-30s.inc.js'))},
  hallRecoveryFixes:{id:'lambda-040-bounded-recovery-v1',sourceCommit,inputSha256:sha256(Buffer.from(roundTrip)),outputSha256:sha256(Buffer.from(recovered)),largeArchiveAdapterSha256:sha256(readFileSync('scripts/lambda-large-archive.mjs'))},
  hallQuotaReadonly:{id:'lambda-040-quota-readonly-v1',sourceCommit,inputSha256:sha256(Buffer.from(recovered)),outputSha256:sha256(output),adapterSha256:sha256(readFileSync('scripts/lambda-quota-readonly.mjs'))}};
const entries=[{path:'lambda-lab.html',data:output},{path:'LICENSE',data:license},{path:'upstream-source.json',data:Buffer.from(JSON.stringify(metadata,null,2)+'\n')}];inspectResources(entries,'lambda-diagram-game');
const target='examples/lambda-diagram-050-20261124';if(existsSync(target))throw Error('Target already exists: '+target);
mkdirSync(target);for(const entry of entries)writeFileSync(`${target}/${entry.path}`,entry.data,{flag:'wx'});
console.log(`Staged Lambda ${pkg.version} from ${revision}; ${sha256(output)}`);
