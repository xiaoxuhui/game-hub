import {readSource,sourceLock,projectRoot} from './inputs.mjs';
import {sha256} from './files.mjs';

// Inventory of fixed bytes, not a JS parser or a security proof. Browser request
// closure/CSP/storage tests remain required even when all lexical counts are zero.
export function inventory(root=projectRoot){
  return sourceLock(root).sources.map(source=>{
    const entries=readSource(root,source),code=entries.filter(f=>/\.(?:html|js|mjs)$/.test(f.path));
    const html=entries.filter(f=>f.path.endsWith('.html'));
    const pages=html.map(file=>{
      const text=file.data.toString('utf8');
      const scripts=[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
      const markup=text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
      return {path:file.path,sha256:sha256(file.data),inlineScripts:scripts.filter(m=>!/(?:^|\s)src\s*=/i.test(m[1])).length,
        scriptSources:scripts.flatMap(m=>[...m[1].matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1])),
        eventAttributes:[...markup.matchAll(/\son[a-z]+\s*=/gi)].length,
        inlineStyles:[...text.matchAll(/<style\b/gi)].length};
    });
    const combined=code.map(f=>f.data.toString('utf8')).join('\n');
    return {id:source.id,revision:source.revision,files:entries.length,bytes:entries.reduce((n,f)=>n+f.data.length,0),storage:source.storage,pages,
      indexedDB:/\bindexedDB\b/.test(combined),sessionStorage:/\bsessionStorage\b/.test(combined),
      serviceWorker:/\bserviceWorker\b/.test(combined),
      evalCalls:/\beval\s*\(/.test(combined),functionConstructor:/\bnew\s+Function\s*\(/.test(combined),
      worker:[...combined.matchAll(/\bnew\s+Worker\([^;]{0,220}/g)].map(m=>m[0]),
      fetch:[...combined.matchAll(/\bfetch\([^;]{0,130}/g)].map(m=>m[0])};
  });
}
console.log(JSON.stringify(inventory(),null,2));
