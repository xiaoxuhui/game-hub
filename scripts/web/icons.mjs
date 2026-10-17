import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export function vectorIcon(root,kind){
  if(!['simulation','logic','puzzle','generic'].includes(kind))throw Error('Unknown icon');
  const xml=readFileSync(join(root,`android/app/src/main/res/drawable/game_dynamic_${kind}.xml`),'utf8');
  const attr=(text,key)=>new RegExp(`android:${key}="([^"]+)"`).exec(text)?.[1];
  const paths=[...xml.matchAll(/<path\b([^>]+)\/>/g)].map(([,attrs])=>{
    const d=attr(attrs,'pathData');if(!d||!/^[a-zA-Z0-9., +\-]+$/.test(d))throw Error('Unsupported vector path');
    const color=value=>{if(!/^#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?$/.test(value))throw Error('Unsupported vector color');return value.length===9?'#'+value.slice(3)+value.slice(1,3):value;};
    let svg=`<path d="${d}" fill="${color(attr(attrs,'fillColor'))}"`;
    if(attr(attrs,'strokeColor'))svg+=` stroke="${color(attr(attrs,'strokeColor'))}" stroke-width="${Number(attr(attrs,'strokeWidth'))}"`;
    return svg+'/>';
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">${paths}</svg>\n`);
}
