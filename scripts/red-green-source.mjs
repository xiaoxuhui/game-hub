import {readFileSync,writeFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url)),target=join(root,'examples/red-green-puzzle');
const repository='https://github.com/xiaoxuhui/turing-machine-simulator.git',revision='592027dbc5cab9cb83f91b904f4f23a9e3cbe24b';
const inputHtmlSha='9ff81f454bf07ba20bfe3e37615b082f049b509ea5ba8d5d2b881c380151d60d';
const inputLicenseSha='12eb4f44e3289367dbba7f173765735d8b7d2bfefa4f027f90d8e38f834838ec';
const hash=data=>createHash('sha256').update(data).digest('hex');
function bytes(path){if(realpathSync(path)!==resolve(path)||!lstatSync(path).isFile())throw new Error('Source link or special file');return readFileSync(path);}
function outputs(){return readdirSync(target).sort().filter(p=>p!=='upstream-source.json').map(path=>{const data=bytes(join(target,path));return {path,bytes:data.length,sha256:hash(data)};});}
export function verifyRedGreenSource(){
  const proof=JSON.parse(bytes(join(target,'upstream-source.json')));
  const fixture=bytes(join(root,'tests/fixtures/red-green-upstream.txt'));
  if(proof.schemaVersion!==1||proof.id!=='red-green-puzzle'||proof.repository!==repository||proof.revision!==revision||proof.entryPage!=='index.html'||proof.maxSize!==10||proof.buildKind!=='reviewed-host-adaptation')throw new Error('Frozen upstream identity');
  if(proof.inputs.length!==2||proof.inputs[0].path!=='doc/red-green-puzzle.html'||proof.inputs[0].sha256!==inputHtmlSha||proof.inputs[0].bytes!==fixture.length||hash(fixture)!==inputHtmlSha)throw new Error('Frozen HTML Git blob differs');
  if(proof.inputs[1].path!=='LICENSE'||proof.inputs[1].sha256!==inputLicenseSha||proof.inputs[1].sha256!==hash(bytes(join(target,'LICENSE')))||proof.inputs[1].bytes!==bytes(join(target,'LICENSE')).length)throw new Error('Full license provenance differs');
  if(JSON.stringify(proof.outputs)!==JSON.stringify(outputs()))throw new Error('Adapted output bytes differ from reviewed provenance');
  return proof;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.slice(2).join(' ')==='--write'){
      const upstream=join(root,'.build/red-green-upstream');
      if(realpathSync(upstream)!==resolve(upstream))throw new Error('Independent source directory link');
      const git=args=>execFileSync('git',args,{cwd:upstream,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
      if(git(['rev-parse','HEAD']).toString().trim()!==revision||git(['remote','get-url','origin']).toString().trim()!==repository||git(['status','--porcelain=v1','--untracked-files=all']).length)throw new Error('Independent frozen checkout differs');
      const inputs=['doc/red-green-puzzle.html','LICENSE'].map(path=>{const data=git(['show',`${revision}:${path}`]);if(!data.equals(bytes(join(upstream,path))))throw new Error('Upstream file differs from Git blob');return {path,bytes:data.length,sha256:hash(data)};});
      const proof={schemaVersion:1,id:'red-green-puzzle',repository,revision,entryPage:'index.html',maxSize:10,buildKind:'reviewed-host-adaptation',changes:['Extract unchanged Gray domain rules; validate 1..10 before allocation','Restore valid local parameters and truthful clipboard fallback','Use local ES module entry and preserve full MIT'],inputs,outputs:outputs()};
      writeFileSync(join(target,'upstream-source.json'),JSON.stringify(proof,null,2)+'\n');
    }else if(process.argv.length!==2)throw new Error('Usage: red-green-source.mjs [--write]');
    const proof=verifyRedGreenSource();console.log(`Verified red-green-puzzle: ${proof.outputs.length} adapted files, frozen upstream ${revision}, maxSize10`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
