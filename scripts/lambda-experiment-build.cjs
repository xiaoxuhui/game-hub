const fs=require('node:fs');
(async()=>{const {protectLambdaOmega}=await import('./lambda-omega-protection.mjs');const input=fs.readFileSync('examples/lambda-diagram-update-20261120/lambda-lab.html','utf8');fs.mkdirSync('.build',{recursive:true});fs.writeFileSync('.build/lambda-android-experiment.html',protectLambdaOmega(input))})().catch(error=>{console.error(error);process.exitCode=1});
