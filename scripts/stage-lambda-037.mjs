import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {sha256} from './resource-protocol.mjs';
import {inspectResources} from './resource-bundle.mjs';
import {integrateLambdaC5Html,lambdaC5IntegrationProof} from './lambda-storage-integration.mjs';
import {protectLambda037} from './lambda-037-protection.mjs';

const source=resolve(process.argv[2]||'.build/upstream-dynamic/lambda-diagram-game');
const git=(...args)=>execFileSync('git',args,{cwd:source,maxBuffer:20*1024*1024});
const revision=git('rev-parse','HEAD').toString().trim(),repository='https://github.com/xiaoxuhui/lambda-diagram-game.git';
if(git('status','--porcelain=v1','--untracked-files=all').toString()||git('remote','get-url','origin').toString().trim()!==repository)throw Error('Clean immutable Lambda checkout required');
const pkg=JSON.parse(git('show',`${revision}:package.json`));if(pkg.version!=='0.3.7')throw Error('Expected Lambda 0.3.7');
const paths=git('ls-tree','-r','--name-only',revision).toString().trim().split(/\r?\n/).filter(p=>/^(?:LICENSE|index\.html|package\.json|scripts\/build(?:-guide-names\.cjs|\.mjs)|src\/.*)$/.test(p)).sort();
const inputs=paths.map(path=>{const data=git('show',`${revision}:${path}`);if(!data.equals(readFileSync(join(source,path))))throw Error('Changed upstream input '+path);return {path,bytes:data.length,sha256:sha256(data)};});
const upstream=git('show',`${revision}:dist/lambda-lab.html`),license=git('show',`${revision}:LICENSE`);
if(!upstream.equals(readFileSync(join(source,'dist/lambda-lab.html'))))throw Error('Tracked Lambda output differs');
const integrated=integrateLambdaC5Html(upstream),output=Buffer.from(protectLambda037(integrated.toString('utf8')));
const proof={schemaVersion:1,id:'lambda-diagram-game',repository,revision,version:pkg.version,buildKind:'inline-html',entryPage:'lambda-lab.html',inputs,
  outputs:[{path:'LICENSE',bytes:license.length,sha256:sha256(license)},{path:'lambda-lab.html',bytes:integrated.length,sha256:sha256(integrated)}],
  trackedArtifact:{path:'dist/lambda-lab.html',bytes:upstream.length,sha256:sha256(upstream),matchesRebuild:true},adaptation:lambdaC5IntegrationProof(upstream,integrated)};
const metadata={...proof,hallProtection:{id:'lambda-037-recovery-v1',inputSha256:sha256(integrated),outputSha256:sha256(output),adapterSha256:sha256(readFileSync('scripts/lambda-037-protection.mjs')),baseAdapterSha256:sha256(readFileSync('scripts/lambda-30s-protection.mjs')),historyGuardSha256:sha256(readFileSync('scripts/lambda-long-history-30s.inc.js'))}};
const entries=[{path:'lambda-lab.html',data:output},{path:'LICENSE',data:license},{path:'upstream-source.json',data:Buffer.from(JSON.stringify(metadata,null,2)+'\n')}];inspectResources(entries,'lambda-diagram-game');
const target='examples/lambda-diagram-update-20261121';mkdirSync(target,{recursive:true});for(const entry of entries)writeFileSync(`${target}/${entry.path}`,entry.data);
writeFileSync('tests/fixtures/lambda-upstream-0.3.7.html',upstream);writeFileSync('tests/fixtures/lambda-upstream-0.3.7.json',JSON.stringify(proof,null,2)+'\n');
console.log(`Staged Lambda ${pkg.version} from ${revision}; ${sha256(output)}`);
