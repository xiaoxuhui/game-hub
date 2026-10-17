import {openResourceDatabase} from '../cache/database.mjs';
import {createPinnedAuthority} from './trust.mjs';
import {createResourceRepository} from './resource-repository.mjs';

export async function openPinnedRepository(options){
  if(!options||Object.keys(options).length!==3||!['indexedDB','origin','basePath'].every(k=>Object.hasOwn(options,k)))throw Error('Production repository trust and clock are fixed');
  const authority=createPinnedAuthority({origin:options.origin,basePath:options.basePath});
  const database=await openResourceDatabase({indexedDB:options.indexedDB,basePath:options.basePath});
  return createResourceRepository({database,authority,now:()=>Date.now()});
}
