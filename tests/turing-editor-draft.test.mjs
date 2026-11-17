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

