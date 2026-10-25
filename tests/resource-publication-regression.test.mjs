import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureReleaseSnapshot} from '../scripts/resource-catalog.mjs';

test('consecutive snapshots bypass fixed-URL cache while keeping consecutive bounded asset pages',async()=>{
  const seen=[],cache=new Map();let generation=1;
  const request=async(input,options)=>{
    const url=new URL(input);seen.push(url);
    assert.equal(url.origin,'https://api.github.com');assert.equal(options.redirect,'error');
    assert.equal(options.headers['Cache-Control'],'no-cache');
    const key=String(url);if(cache.has(key))return cache.get(key).clone();
    let value,headers={};
    if(url.pathname.endsWith('/tags/game-resources-v2'))value={id:407394942,tag_name:'game-resources-v2',draft:false,prerelease:true};
    else{
      assert.equal(url.pathname,'/repos/xiaoxuhui/game-hub/releases/407394942/assets');assert.equal(url.searchParams.get('per_page'),'100');
      const page=Number(url.searchParams.get('page'));assert.ok([1,2].includes(page));
      value=page===1?Array.from({length:100},(_,i)=>({id:i+1,name:'asset-'+i})): [{id:101,name:'generation-'+generation}];
      if(page===1)headers.link='<https://api.github.com/repos/xiaoxuhui/game-hub/releases/407394942/assets?per_page=100&page=2>; rel="next"';
    }
    const response=Response.json(value,{headers});cache.set(key,response.clone());return response;
  };
  const first=await captureReleaseSnapshot(request,'game-resources-v2');generation=2;
  const second=await captureReleaseSnapshot(request,'game-resources-v2');
  assert.equal(first.assetPages[1].assets[0].name,'generation-1');assert.equal(second.assetPages[1].assets[0].name,'generation-2');
  assert.equal(new Set(seen.map(String)).size,6);
  for(const url of seen)assert.match(url.searchParams.get('snapshot_request')??'',/^[a-f0-9-]{36}$/);
});

test('snapshot cache key does not weaken pagination origin path or sequence checks',async()=>{
  for(const next of ['https://evil.example/assets?per_page=100&page=2','https://api.github.com/repos/xiaoxuhui/other/releases/1/assets?per_page=100&page=2','https://api.github.com/repos/xiaoxuhui/game-hub/releases/1/assets?per_page=100&page=3']){
    let calls=0;await assert.rejects(captureReleaseSnapshot(async()=>++calls===1?Response.json({id:1,tag_name:'game-resources-v2',draft:false,prerelease:true}):Response.json([],{headers:{link:`<${next}>; rel="next"`}}),'game-resources-v2'),/Unexpected next page/);assert.equal(calls,2);
  }
});

test('actual publisher receipt serialization preserves zero one and multiple upload arrays',{skip:process.platform!=='win32'},()=>{
  const directory=mkdtempSync(join(tmpdir(),'hub-receipt-'));
  try{for(const name of ['publish-resource-successor.ps1','publish-resource-v1-successor.ps1']){
    const script=readFileSync(new URL('../scripts/'+name,import.meta.url),'utf8'),line=script.split(/\r?\n/).find(l=>l.includes("'uploaded-resources.json'")&&l.includes('ConvertTo-Json'));
    assert.ok(line,'Actual publisher receipt write must exist');
    for(const count of [1,0,2]){
      const taskDirectory=directory.replaceAll("'","''");
      const code=`$ErrorActionPreference='Stop';$taskDirectory='${taskDirectory}';$uploads=@();for($i=0;$i -lt ${count};$i++){$uploads += [pscustomobject]@{id=($i+1);name=('game-'+$i);size=100;state='uploaded';digest='sha256:abc'}};${line};Get-Content -Raw -LiteralPath (Join-Path $taskDirectory 'uploaded-resources.json')`;
      const result=JSON.parse(execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8'}).replace(/^\uFEFF/,''));
      assert.ok(Array.isArray(result),name+' count '+count+' must remain array');assert.equal(result.length,count);for(let i=0;i<count;i++)assert.equal(result[i].id,i+1);
    }
  }}finally{rmSync(directory,{recursive:true,force:true});}
});
