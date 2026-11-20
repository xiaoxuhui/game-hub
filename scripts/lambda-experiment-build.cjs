const fs=require('node:fs');
let html=fs.readFileSync('examples/lambda-diagram-update-20261120/lambda-lab.html','utf8');
function replace(a,b){if(html.split(a).length!==2)throw Error('ambiguous marker: '+a);html=html.replace(a,b)}
replace('async function convert() {','async function convert({initial=false}={}) {');
replace('state.autoFit=true; render(); save(); return true;','state.autoFit=true; render(); if(!initial)save(); return true;');
replace('workspace.prepareManualRestore();renderMode();convert();lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;','workspace.prepareManualRestore();renderMode();convert({initial:true});lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;');
fs.mkdirSync('.build',{recursive:true});fs.writeFileSync('.build/lambda-android-experiment.html',html);
