import {validateProject} from './project.js';
export const PROJECT_KEY='inspiration-blocks-v3';
export const PREVIOUS_KEY='inspiration-blocks-v2';
export const PREVIOUS_BACKUP_KEY='inspiration-blocks-v2-legacy-backup';
export const LEGACY_KEY='inspiration-blocks-v1';
export const LEGACY_BACKUP_KEY='inspiration-blocks-v1-legacy-backup';
export function loadProject(storage){for(const key of [PROJECT_KEY,PREVIOUS_KEY,LEGACY_KEY]){const data=storage.getItem(key);if(data!==null)return validateProject(JSON.parse(data));}return null;}
export function saveProject(storage,project){
  const valid=validateProject(project),legacy=storage.getItem(LEGACY_KEY);
  if(legacy!==null&&storage.getItem(LEGACY_BACKUP_KEY)===null)storage.setItem(LEGACY_BACKUP_KEY,legacy);
  const previous=storage.getItem(PREVIOUS_KEY);if(previous!==null&&storage.getItem(PREVIOUS_BACKUP_KEY)===null)storage.setItem(PREVIOUS_BACKUP_KEY,previous);
  storage.setItem(PROJECT_KEY,JSON.stringify(valid));
  // Keep the old reader's slot untouched, even when editing a legacy project.
  return valid;
}
