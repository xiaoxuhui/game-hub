// Pure activation state machine. The caller verifies signed payloads and the
// complete release snapshot separately before using this result for any write.
export function expandedActivationState(snapshot,intent){
 const fail=m=>{throw Error(m)};
 if(!intent||intent.previousSha===intent.newSha||intent.legacyId===intent.previousId||!/^[a-f0-9]{64}$/.test(intent.legacySha??'')||!/^[a-f0-9]{64}$/.test(intent.previousSha??'')||!/^[a-f0-9]{64}$/.test(intent.newSha??'')||!Number.isSafeInteger(intent.legacyId)||intent.legacyId<1||!Number.isSafeInteger(intent.previousId)||intent.previousId<1||!Number.isSafeInteger(intent.newSize)||intent.newSize<1||!/^[1-9][0-9]{0,18}$/.test(intent.previousSequence??''))fail('Invalid activation intent');
 const release=snapshot?.release,pages=snapshot?.assetPages;
 if(snapshot?.schemaVersion!==1||snapshot.pageSize!==100||release?.id!==407394942||release.tag_name!=='game-resources-v2'||release.draft!==false||release.prerelease!==true||!Array.isArray(pages)||pages.length<1||pages.length>100)fail('Invalid activation snapshot');
 for(let i=0;i<pages.length;i++){const page=pages[i];if(page.page!==i+1||page.hasNext!==(i<pages.length-1)||!Array.isArray(page.assets)||page.assets.length>100||(page.hasNext&&page.assets.length!==100))fail('Incomplete activation pages');}
 const assets=pages.flatMap(p=>p.assets);if(new Set(assets.map(a=>a.id)).size!==assets.length||new Set(assets.map(a=>a.name)).size!==assets.length)fail('Duplicate activation assets');
 const get=name=>assets.filter(a=>a.name===name);const legacy=get('catalog.signed.json'),active=get('catalog-expanded.signed.json'),historyName=`catalog-expanded-seq${intent.previousSequence}-${intent.previousSha.slice(0,12)}.signed.json`,history=get(historyName);
 if(intent.historyName!==historyName)fail('Unexpected history name');
 if(legacy.length!==1||legacy[0].id!==intent.legacyId||legacy[0].state!=='uploaded'||legacy[0].digest!==`sha256:${intent.legacySha}`)fail('Legacy changed before activation');
 const old=history[0];if(old&&(old.id!==intent.previousId||old.state!=='uploaded'||old.digest!==`sha256:${intent.previousSha}`))fail('Expanded history identity mismatch');
 if(active.length===1&&active[0].id===intent.previousId&&active[0].state==='uploaded'&&active[0].digest===`sha256:${intent.previousSha}`&&history.length===0)return {phase:'prepared',historyName};
 if(active.length===0&&history.length===1)return {phase:'renamed',historyName};
 if(active.length===1&&history.length===1&&active[0].state==='uploaded'&&active[0].digest===`sha256:${intent.newSha}`&&active[0].size===intent.newSize&&active[0].id!==intent.previousId)return {phase:'published',historyName,assetId:active[0].id};
 fail('Unknown or conflicting expanded activation state');
}
