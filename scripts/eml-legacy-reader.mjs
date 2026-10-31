import{readFileSync}from'node:fs';
import{sha256}from'./resource-protocol.mjs';
export const EML_REVISION='cb408648ad4233baba757a530aa39278ecdb5127';
export const EML_LEGACY_REVISION='2616c9e9b081762b01599cc79da919d20340d0a2';
export const EML_INTEGRATION='eml-base-full-preservation-v1';
export const EML_OLD_HASHES=Object.freeze({
 'expression.js':'3fab49a3241ecf4ae44d163ca10408cd815d4a7a507d243cd6b54dcd9ae2cad5',
 'value-store.js':'079e65314a4b6cdf95e4058a12a459994fe76add63a5e65b6997c2aa907d1c8c',
 'persistence.js':'ecf8cd7fec867f2930754ad4ea8ff351c9645f04fb2ebfad50e9fd0e3888343b',
});
export function emlLegacyRuntime(){
 const factories=Object.entries(EML_OLD_HASHES).map(([name,hash])=>{
  const bytes=readFileSync(new URL('../tests/fixtures/eml/old/'+name,import.meta.url));
  if(sha256(bytes)!==hash)throw Error('Frozen EML legacy reader bytes changed');
  return JSON.stringify(name)+':function(module,require){\n'+bytes.toString('utf8')+'\n}';
 }).join(',\n');
 // The original UMD modules also assign global names; a lexical isolated root protects the live engine.
 return Buffer.from(`(function(root){'use strict';const globalThis={};const factories={${factories}};const cache=Object.create(null);function load(name){name=name.replace(/^\\.\\//,'');if(!Object.prototype.hasOwnProperty.call(factories,name))throw Error('Unknown frozen EML module');if(!cache[name]){const module={exports:{}};cache[name]=module;factories[name](module,load);}return cache[name].exports;}root.EMLHubLegacy={expression:load('expression.js'),store:load('value-store.js'),persistence:load('persistence.js')};})(globalThis);\n`);
}
