import {protectLambdaOmega} from './lambda-30s-protection.mjs';

export function protectLambda037(source){
  const protectedHtml=protectLambdaOmega(source);
  const before='workspace.prepareManualRestore();renderMode();if(!workspace.restoreProtected())convert({initial:true});lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;workspace.finishStartup();';
  const after='workspace.prepareManualRestore();renderMode();Promise.resolve(workspace.restoreProtected()?true:convert({initial:true})).then(()=>{lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;workspace.finishStartup();});';
  if(protectedHtml.split(before).length!==2)throw Error('Lambda 0.3.7 startup completion marker changed');
  return protectedHtml.replace(before,after);
}
