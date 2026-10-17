import {test,expect} from '@playwright/test';
import {TEST_KEY_ID,TEST_TIME,testSpki,signRaw,signPayload,signedPayload} from '../../tests/fixtures/web-signed.mjs';

test('real WebCrypto accepts all eight signed resource identities and refuses byte tampering',async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json();
  const payload=signedPayload({catalog,origin:'http://127.0.0.1:18427'});
  const raw=' \n'+JSON.stringify(payload,null,2)+'\n',valid=signRaw(raw),changed=JSON.parse(valid);changed.signatureBase64='A'.repeat(512);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
  const result=await page.evaluate(async({valid,changed,spki,keyId,now})=>{
    const {verifySignedCatalog}=await import(new URL('core/signed-catalog.mjs',location.href));
    const options={spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/',now};
    const good=await verifySignedCatalog(new Uint8Array(valid),options);let rejected=false;
    try{await verifySignedCatalog(new TextEncoder().encode(JSON.stringify(changed)),options);}catch{rejected=true;}
    return {ids:good.catalog.games.map(g=>g.id),frozen:Object.isFrozen(good.catalog.games[0].files)&&Object.isFrozen(good.history.games),rejected,sequence:good.history.catalogSequence};
  },{valid:[...valid],changed,spki:[...testSpki],keyId:TEST_KEY_ID,now:TEST_TIME});
  expect(result).toEqual({ids:catalog.games.map(g=>g.id),frozen:true,rejected:true,sequence:'1'});expect(errors).toEqual([]);
});

test('real WebCrypto enforces prior identities, expiry and deployment scope',async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json(),base=signedPayload({catalog,origin:'http://127.0.0.1:18427'});
  const sameCode=structuredClone(base);sameCode.catalogSequence='2';sameCode.games[0].releaseNotes='同编号不得替换';
  const expired=structuredClone(base);expired.expiresAt=new Date(TEST_TIME).toISOString();
  const scope=structuredClone(base);scope.basePath='/other/';
  const next=structuredClone(base);next.catalogSequence='2';next.games[0].contentCode++;next.games[0].entryUrl=next.games[0].entryUrl.replace(`/1/`,`/2/`);
  await page.goto('./');
  const result=await page.evaluate(async({vectors,spki,keyId,now})=>{
    const {verifySignedCatalog}=await import(new URL('core/signed-catalog.mjs',location.href));
    const options={spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/',now};
    const bytes=i=>new Uint8Array(vectors[i]),first=await verifySignedCatalog(bytes(0),options),rejected=[];
    for(const i of [1,2,3]){try{await verifySignedCatalog(bytes(i),{...options,history:first.history});rejected.push(false);}catch{rejected.push(true);}}
    const second=await verifySignedCatalog(bytes(4),{...options,history:first.history});let rollback=false;
    try{await verifySignedCatalog(bytes(0),{...options,history:second.history});}catch{rollback=true;}
    return {rejected,rollback,sequence:second.history.catalogSequence,code:second.history.games[0].contentCode};
  },{vectors:[base,sameCode,expired,scope,next].map(p=>[...signPayload(p)]),spki:[...testSpki],keyId:TEST_KEY_ID,now:TEST_TIME});
  expect(result).toEqual({rejected:[true,true,true],rollback:true,sequence:'2',code:catalog.games[0].contentCode+1});
});
