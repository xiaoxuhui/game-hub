import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {files,sha256} from './files.mjs';
import {strictJson} from '../resource-protocol.mjs';

const cache=new Map(),clones=entries=>entries.map(file=>({...file,data:Buffer.from(file.data)}));
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noEmit:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
export function splitEmlBeforeUI(text){
  const ast=ts.createSourceFile('eml-workbench.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),names=['EMLExpression','EMLExpressionProperties','EMLTranscendentalRules','EMLAlgebraRules','EMLFormulaRules','EMLEvaluator','EMLValueStore','EMLPersistence','EMLTreeViewport','EMLTreeController','EMLDerivationTrace','EMLApp'];
  if(ast.parseDiagnostics.length||ast.statements.length!==names.length||ast.statements.some((statement,index)=>!ts.isExpressionStatement(statement)||!statement.getText(ast).includes(`root.${names[index]} =`)))throw Error('Unreviewed EML library/UI boundary');
  const boundary=ast.statements[8].getFullStart();return [text.slice(0,boundary),text.slice(boundary)];
}
export function nativeTuring(root,source){
  const directory=join(root,'web/native-validation/turing'),manifest=strictJson(readFileSync(join(directory,'provenance.json'))),raw=files(directory);
  if(manifest.schemaVersion!==1||manifest.gameId!==source.id||source.id!=='turing'||manifest.repository!==source.repository||manifest.revision!==source.revision||manifest.compiler?.name!=='typescript'||manifest.compiler.version!=='5.9.3'||ts.version!==manifest.compiler.version)throw Error('Native Turing provenance/compiler mismatch');
  const expected=['LICENSE','campaign.ts','core.ts','examples.ts','project-codec.ts'];
  if(manifest.files.map(f=>f.path).sort().join()!==expected.join()||raw.map(f=>f.path).sort().join()!==[...expected,'provenance.json'].sort().join())throw Error('Native Turing source file mismatch');
  for(const entry of manifest.files){
    const file=raw.find(f=>f.path===entry.path);
    if(entry.sourcePath!==(entry.path==='LICENSE'?'LICENSE':'src/'+entry.path)||file.data.length!==entry.bytes||sha256(file.data)!==entry.sha256)throw Error('Native Turing source provenance bytes mismatch');
    if(entry.path.endsWith('.ts')){
      const info=ts.preProcessFile(file.data.toString('utf8'),true,true);
      if(info.referencedFiles.length||info.typeReferenceDirectives.length||info.libReferenceDirectives.length||info.importedFiles.some(f=>!['./core','./examples'].includes(f.fileName)))throw Error('Unreviewed native validator dependency');
    }
  }
  const key=sha256(Buffer.concat(raw.flatMap(f=>[Buffer.from(f.path+'\0'),f.data])));if(cache.has(key))return clones(cache.get(key));
  const program=ts.createProgram(expected.filter(p=>p.endsWith('.ts')).map(p=>join(directory,p)),options),diagnostics=ts.getPreEmitDiagnostics(program);
  if(diagnostics.length)throw Error(ts.formatDiagnostics(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
  const output=[];
  for(const name of ['core','project-codec','campaign']){
    const result=ts.transpileModule(raw.find(f=>f.path===name+'.ts').data.toString('utf8'),{fileName:name+'.ts',compilerOptions:{...options,noEmit:false},reportDiagnostics:true});
    if(result.diagnostics?.length)throw Error('Native validator emission failed');
    const text=result.outputText.replaceAll('from "./core"','from "./core.mjs"');
    const emitted=ts.preProcessFile(text,true,true);if(emitted.importedFiles.some(f=>f.fileName!=='./core.mjs'))throw Error('Native validator emitted outside closure');
    output.push({path:name+'.mjs',data:Buffer.from(text)});
  }
  output.push({path:'LICENSE',data:raw.find(f=>f.path==='LICENSE').data},{path:'provenance.json',data:readFileSync(join(directory,'provenance.json'))});cache.set(key,clones(output));return output;
}
export function nativeLambda(source,raw){
  if(source.id!=='lambda-diagram-game')throw Error('Native Lambda identity mismatch');
  const page=raw.find(f=>f.path===source.entryPage),proof=source.files.find(f=>f.path===source.entryPage);
  if(!page||sha256(page.data)!==proof?.sha256)throw Error('Native Lambda source mismatch');
  const names=['createLambdaStorage','migrateLambdaStorage'],found=new Map(names.map(name=>[name,[]]));
  for(const [index,match] of [...page.data.toString('utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].entries()){
    const ast=ts.createSourceFile('lambda-'+index+'.js',match[1],ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
    if(ast.parseDiagnostics.length)throw Error('Native Lambda parser diagnostics');
    function visit(node){if(ts.isFunctionExpression(node)&&found.has(node.name?.text))found.get(node.name.text).push(node.getText(ast));ts.forEachChild(node,visit);}visit(ast);
  }
  if([...found.values()].some(nodes=>nodes.length!==1))throw Error('Unreviewed native Lambda storage helpers');
  const code=names.map(name=>`export const ${name}=(${found.get(name)[0]});`).join('\n')+'\n';
  const provenance={schemaVersion:1,gameId:source.id,repository:source.repository,revision:source.revision,sourcePath:source.entryPage,sourceSha256:proof.sha256,functions:names,license:'lambda-storage.LICENSE.txt',transform:'Extract exact named native function expressions, without executing the UI'};
  return [{path:'lambda-storage.mjs',data:Buffer.from(code)},{path:'lambda-storage.provenance.json',data:Buffer.from(JSON.stringify(provenance,null,2)+'\n')},{path:'lambda-storage.LICENSE.txt',data:raw.find(f=>f.path==='LICENSE').data}];
}
