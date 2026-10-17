import {validateProject} from './project.js';
export const PROJECT_KEY='inspiration-blocks-v2';
export const LEGACY_KEY='inspiration-blocks-v1';
export const LEGACY_BACKUP_KEY='inspiration-blocks-v1-legacy-backup';
export function loadProject(storage){const modern=storage.getItem(PROJECT_KEY);if(modern!==null)return validateProject(JSON.parse(modern));const legacy=storage.getItem(LEGACY_KEY);return legacy===null?null:validateProject(JSON.parse(legacy));}
export function saveProject(storage,project){
  const valid=validateProject(project),legacy=storage.getItem(LEGACY_KEY);
  if(legacy!==null&&storage.getItem(LEGACY_BACKUP_KEY)===null)storage.setItem(LEGACY_BACKUP_KEY,legacy);
  storage.setItem(PROJECT_KEY,JSON.stringify(valid));
  // Keep the old reader's slot untouched, even when editing a legacy project.
  return valid;
}
