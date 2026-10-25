import {sha256} from './resource-protocol.mjs';
export const CONWAY_REVISION='a531a560b3ecce070be80fb6470cbc916971bce4';
export const CONWAY_INTEGRATION='conway-v2-world-archive-v1';
export const CONWAY_ARCHIVE_KEY='conway-hub-world-archive-v1';
export const CONWAY_CORE_SHA='a2993a60198ca2cc5517435b8b94d312afbe0fef28909ac6c30080b06367d89a';
export function adaptConwayCore(bytes){
 if(sha256(bytes)!==CONWAY_CORE_SHA)throw Error('Unreviewed Conway core bytes');
 let text=bytes.toString('utf8');
 const replacements=[
  ['version: FORMAT_VERSION,','version: PREVIOUS_VERSION,'],
  ['const rule = data.version === FORMAT_VERSION ? parseRule(data.rule).canonical : DEFAULT_RULE;','const rule = data.version === LEGACY_VERSION || data.rule === undefined ? DEFAULT_RULE : parseRule(data.rule).canonical;'],
 ];
 for(const [before,after]of replacements){if(text.split(before).length!==2)throw Error('Conway reviewed format marker changed');text=text.replace(before,after);}
 return Buffer.from(text);
}
