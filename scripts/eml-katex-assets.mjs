import{readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync}from'node:fs';import{join}from'node:path';import{sha256}from'./resource-protocol.mjs';
import{EML_REVISION,EML_LEGACY_REVISION,EML_OLD_HASHES}from'./eml-legacy-reader.mjs';
export const EML_CSS_SHA='f787891b550d554c214aa8902f39ac46df2dbd48fdec500a2040a5dce1e8ab58';
export const EML_BUILD_INPUTS_SHA='0e4668ee5ee34a7cc4053f6c5eea8320ef363852114cae411bd94121a2a03e2d';
const PROOF_SHA='4ea02107b40e79834e68f573a14bc936cb04c2d4cdf9d393ca5b704b88b4b11b';
export function emlBuildInputs(){const bytes=readFileSync(new URL('../tests/fixtures/eml/build-inputs.source.json',import.meta.url));if(sha256(bytes)!==EML_BUILD_INPUTS_SHA)throw Error('Frozen EML build-input proof changed');return JSON.parse(bytes);}
export function emlKaTeXProof(){const bytes=readFileSync(new URL('../licenses/katex-0.16.21.proof.json',import.meta.url));if(sha256(bytes)!==PROOF_SHA)throw Error('Frozen official KaTeX proof changed');return JSON.parse(bytes);}
export const EML_RESOURCE_FILES=Object.freeze(['eml-workbench.html','hub/eml-legacy-reader.js','hub/eml-format.js','hub/eml-preservation.js','hub/eml-ui.js','hub-source-proof.json','katex/katex.js','katex/katex.min.css',...emlKaTeXProof().fonts.map(font=>'katex/'+font.path),'licenses/katex-0.16.21.MIT.txt','licenses/katex-fonts.MIT.txt']);
export function stageEMLLicenses(directory){
 const proof=emlKaTeXProof();mkdirSync(join(directory,'licenses'),{recursive:true});
 for(const license of proof.licenses){const bytes=readFileSync(new URL('../licenses/'+license.file,import.meta.url));if(sha256(bytes)!==license.sha256)throw Error('EML third-party license changed');writeFileSync(join(directory,'licenses',license.file),bytes);}
 return proof;
}
export function pruneEMLFontFallbacks(bytes){
 if(sha256(bytes)!==EML_CSS_SHA)throw Error('Unreviewed EML KaTeX CSS bytes');
 const proof=emlKaTeXProof(),expected=new Set(proof.fonts.map(font=>font.path)),seen=new Set();let count=0;
 const output=bytes.toString('utf8').replace(/@font-face\{[^{}]*\}/g,face=>{
  count++;const sources=[...face.matchAll(/src:([^;}]+)/g)];if(sources.length!==1)throw Error('KaTeX font source marker changed');
  const groups=sources[0][1].split(',');if(groups.length!==3)throw Error('KaTeX reviewed fallback count changed');
  const parsed=groups.map(group=>/^url\((fonts\/KaTeX_[A-Za-z0-9_-]+)\.(woff2|woff|ttf)\)\s+format\("(woff2|woff|truetype)"\)$/.exec(group));
  if(parsed.some(part=>!part)||parsed.some((part,index)=>part[2]!==['woff2','woff','ttf'][index]||part[3]!==['woff2','woff','truetype'][index]||part[1]!==parsed[0][1]))throw Error('KaTeX reviewed font family/format changed');
  const font=parsed[0][1]+'.woff2';if(!expected.has(font)||seen.has(font))throw Error('KaTeX reviewed font identity changed');seen.add(font);
  return face.replace(sources[0][0],'src:'+groups[0]);
 });
 if(count!==20||seen.size!==20)throw Error('Twenty complete KaTeX font faces required');
 const refs=[...output.matchAll(/url\(([^)]+)\)/g)].map(match=>match[1]);if(refs.length!==20||refs.some(path=>!expected.has(path)))throw Error('KaTeX font references are not closed');
 return Buffer.from(output);
}
function walk(directory,prefix=''){return readdirSync(directory).sort().flatMap(name=>{const path=join(directory,name),stat=lstatSync(path),relative=prefix+name;if(stat.isSymbolicLink())throw Error('EML built resource link');if(stat.isDirectory())return walk(path,relative+'/');if(!stat.isFile())throw Error('EML built resource special file');return[relative];});}
export function finalizeEMLAssets(directory){
 const official=emlKaTeXProof(),files=walk(directory),expected=[...EML_RESOURCE_FILES,'LICENSE'].sort();if(JSON.stringify(files.sort())!==JSON.stringify(expected))throw Error('EML complete resource file set differs');
 const proof=JSON.parse(readFileSync(join(directory,'hub-source-proof.json')));
 if(proof.schemaVersion!==1||proof.repository!=='https://github.com/xiaoxuhui/EML.git'||proof.integration!=='eml-base-full-preservation-v1'||proof.revision!==EML_REVISION||JSON.stringify(proof.inputs)!==JSON.stringify(emlBuildInputs())||JSON.stringify(proof.thirdParty)!==JSON.stringify(official))throw Error('EML source proof binding changed');
 const legacySource={repository:'https://github.com/xiaoxuhui/EML.git',revision:EML_LEGACY_REVISION,inputs:Object.entries(EML_OLD_HASHES).map(([name,hash])=>({path:'src/'+name,sha256:hash})),licenseSha256:sha256(readFileSync(new URL('../tests/fixtures/eml/old/LICENSE',import.meta.url)))};
 if(JSON.stringify(proof.legacySource)!==JSON.stringify(legacySource))throw Error('EML frozen legacy input proof changed');
 if(Object.keys(proof.runtimeFiles).sort().join()!==EML_RESOURCE_FILES.filter(path=>path.startsWith('hub/')).sort().join())throw Error('EML runtime identity proof changed');
 for(const[name,hash]of Object.entries(proof.runtimeFiles))if(sha256(readFileSync(join(directory,name)))!==hash)throw Error('EML runtime byte proof changed');
 const adapters=['eml-resource-integration.mjs','eml-legacy-reader.mjs','eml-compatibility.mjs','eml-preservation.mjs','eml-compatibility-ui.mjs','eml-katex-assets.mjs'];
 if(Object.keys(proof.adapters).sort().join()!==[...adapters].sort().join())throw Error('EML adapter identity proof changed');
 for(const name of adapters)if(sha256(readFileSync(new URL(name,import.meta.url)))!==proof.adapters[name])throw Error('EML adapter bytes changed');
 const html=readFileSync(join(directory,'eml-workbench.html'));if(html.length!==proof.expectedHTML?.bytes||sha256(html)!==proof.expectedHTML?.sha256)throw Error('EML compiled HTML differs from reviewed immutable build inputs');
 if(sha256(readFileSync(join(directory,'katex/katex.js')))!==official.customBundledJS.sha256)throw Error('EML fixed KaTeX custom bundle changed');
 for(const font of official.fonts)if(sha256(readFileSync(join(directory,'katex',font.path)))!==font.sha256)throw Error('EML font differs from official fixed distribution');
 for(const license of official.licenses)if(sha256(readFileSync(join(directory,'licenses',license.file)))!==license.sha256)throw Error('EML packaged license changed');
 const css=readFileSync(join(directory,'katex/katex.min.css')),pruned=pruneEMLFontFallbacks(css);writeFileSync(join(directory,'katex/katex.min.css'),pruned);
 proof.cssTransformation={inputSha256:sha256(css),outputSha256:sha256(pruned),fontFaces:20,retainedFormat:'woff2',removedMissingFallbacks:['woff','ttf']};
 proof.outputs=files.filter(path=>path!=='hub-source-proof.json').sort().map(path=>{const bytes=readFileSync(join(directory,path));return{path,bytes:bytes.length,sha256:sha256(bytes)};});
 writeFileSync(join(directory,'hub-source-proof.json'),JSON.stringify(proof,null,2)+'\n');return proof;
}
