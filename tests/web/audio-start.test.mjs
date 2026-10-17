import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumeAudio} from '../../web/src/runtime/audio-start.mjs';
import {guardAudioStart} from '../../scripts/web/audio-adapter.mjs';
test('native audio startup settles on success, rejection or an unresponsive backend',async()=>{
  assert.equal(await resumeAudio({resume:async()=>'ready'}),'ready');const error=Error('native audio failure');await assert.rejects(resumeAudio({resume:async()=>{throw error;}}),value=>value===error);let finish;const pending=new Promise(resolve=>{finish=resolve;});await assert.rejects(resumeAudio({resume:()=>pending},5),/声音设备启动超时/);finish();
});
test('audio adapter changes only the audited native resume and rejects unknown structure',()=>{
  const raw=Buffer.from('async function unlock(){if(context.state==="suspended")await context.resume();}'),files=[{path:'src/audio.js',data:raw},{path:'other.js',data:raw}];const output=guardAudioStart('mini-scratch',files);assert.match(output[0].data.toString(),/await globalThis.GameHubResumeAudio\(context\)/);assert.equal(output[1].data,raw);assert.equal(files[0].data,raw);assert.equal(guardAudioStart('eml',files),files);assert.throws(()=>guardAudioStart('mini-scratch',[]),/layout/);assert.throws(()=>guardAudioStart('mini-scratch',[{path:'src/audio.js',data:Buffer.from('async function f(){await something.resume();}')}]),/startup/);assert.throws(()=>guardAudioStart('mini-scratch',[{path:'src/audio.js',data:Buffer.from('const noResume=true;')}]),/count/);
});
