import {buildSync} from 'esbuild';
import {join} from 'node:path';
export function bundleServiceWorker(root,{basePath,build,shell}){
  const result=buildSync({absWorkingDir:root,entryPoints:[join(root,'web/sw/entry.mjs')],bundle:true,write:false,metafile:true,format:'iife',platform:'browser',target:'es2022',charset:'utf8',legalComments:'inline',define:{__HUB_BUILD__:JSON.stringify(build),__HUB_BASE__:JSON.stringify(basePath),__HUB_SHELL__:JSON.stringify(shell)}});
  if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(output=>output.imports.length))throw Error('SW must be one closed classic script');
  return Buffer.from(result.outputFiles[0].contents);
}
