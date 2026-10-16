import {existsSync,renameSync} from 'node:fs';
import {inside,removeOwned} from './files.mjs';

// Local, stopped-server handoff: the two renames are NOT atomic to readers.
// Public deployments need the separate immutable-generation/pointer contract.
export function replaceLocalOutput({buildRoot,staging,output,backup,validate}){
  for(const path of [staging,output,backup])inside(buildRoot,path);
  if(existsSync(backup))throw Error('Backup already exists');
  const hadOutput=existsSync(output);
  if(hadOutput)renameSync(output,backup);
  try{
    renameSync(staging,output);
    const result=validate(output);
    if(hadOutput)removeOwned(buildRoot,backup);
    return result;
  }catch(error){
    if(existsSync(output))removeOwned(buildRoot,output);
    if(hadOutput&&existsSync(backup))renameSync(backup,output);
    throw error;
  }
}
