import {existsSync,renameSync} from 'node:fs';
import {inside,removeOwned} from './files.mjs';

// Local, stopped-server handoff: the two renames are NOT atomic to readers.
// Public deployments need the separate immutable-generation/pointer contract.
export function replaceLocalOutput({buildRoot,staging,output,backup,validate,cleanup=removeOwned}){
  for(const path of [staging,output,backup])inside(buildRoot,path);
  if(existsSync(backup))throw Error('Backup already exists');
  const hadOutput=existsSync(output);
  if(hadOutput)renameSync(output,backup);
  let result;
  try{
    renameSync(staging,output);
    result=validate(output);
  }catch(error){
    if(existsSync(output))removeOwned(buildRoot,output);
    if(hadOutput&&existsSync(backup))renameSync(backup,output);
    throw error;
  }
  // Cleanup may partially remove the backup. Never roll back a verified output
  // from that point onward; retain it and report the leftover for inspection.
  if(hadOutput)try{cleanup(buildRoot,backup);}catch(error){
    throw new Error('Verified output retained; previous backup cleanup failed: '+backup,{cause:error});
  }
  return result;
}
