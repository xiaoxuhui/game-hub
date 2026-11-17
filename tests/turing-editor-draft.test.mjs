import test from 'node:test';
import assert from 'node:assert/strict';
import { createTuringEditorDraft } from '../scripts/turing-compatibility-ui.mjs';
const fields={input:'11',blankSymbol:'_',initialState:'q0',acceptStates:'qa',rejectStates:'qr',haltStates:'',rules:'unfinished rule'};
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
test('unfinished editor content survives reload without replacing newer old-version edits',()=>{
  const storage=memory(), draft=createTuringEditorDraft(storage);
  draft.save(fields,'old-project');
  assert.deepEqual(createTuringEditorDraft(storage).load('old-project'),fields);
  assert.equal(createTuringEditorDraft(storage).load('changed-old-project'),null);
});
test('draft write failure or concurrent edit never silently overwrites the existing draft',()=>{
  const storage=memory(), first=createTuringEditorDraft(storage), second=createTuringEditorDraft(storage);
  first.save(fields,'old');
  assert.throws(()=>second.save({...fields,input:'other'},'old'),/修改/);
  assert.equal(createTuringEditorDraft(storage).load('old').input,'11');
});
test('updating the matching project rebases its draft without changing editor content',()=>{
  const storage=memory(), draft=createTuringEditorDraft(storage);draft.save(fields,'before');
  draft.rebase('before','after');
  assert.deepEqual(createTuringEditorDraft(storage).load('after'),fields);
  assert.equal(createTuringEditorDraft(storage).load('before'),null);
});

test('a draft from a different older project is archived before saving the current edit',()=>{
  const storage=memory(), old=createTuringEditorDraft(storage);old.save(fields,'old-project');
  const archived=[], current=createTuringEditorDraft(storage,raw=>archived.push(raw));
  current.save({...fields,input:'new'},'new-project');
  assert.equal(JSON.parse(archived[0]).input,'11');assert.equal(createTuringEditorDraft(storage).load('new-project').input,'new');
});
test('if archiving the old draft fails, its original bytes stay intact',()=>{
  const storage=memory(), old=createTuringEditorDraft(storage);old.save(fields,'old-project');
  const current=createTuringEditorDraft(storage,()=>{throw Error('archive full')});
  assert.throws(()=>current.save({...fields,input:'new'},'new-project'),/archive full/);
  assert.equal(createTuringEditorDraft(storage).load('old-project').input,'11');
});
test('a damaged previous draft is archived before allowing a new one',()=>{
  const storage=memory();storage.setItem('turing-machine-simulator.editor-draft.v1','{broken');
  const archived=[], draft=createTuringEditorDraft(storage,raw=>archived.push(raw));
  draft.save(fields,'base');assert.deepEqual(archived,['{broken']);assert.equal(createTuringEditorDraft(storage).load('base').input,'11');
});
