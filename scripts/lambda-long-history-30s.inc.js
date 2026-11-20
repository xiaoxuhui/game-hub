    // Never synchronously replay a long stored session during compatibility checks.
    // Open a separate namespace and keep every original key untouched.
    const guardedKeys=['lambda-lab-hub-v4','lambda-lab-hub-checkpoint-v4','lambda-lab-hub-v3','lambda-lab-hub-checkpoint-v3','lambda-lab-v2','lambda-lab-checkpoint-v2','lambda-lab-hub-legacy-v4','lambda-lab-v1','lambda-lab-hub-journal-v4','lambda-lab-hub-journal-v3'];
    const prefixBase='lambda-hub-safe-workspace-v1.';
    function scope(source,prefix){return {getItem:key=>source.getItem(prefix+key),setItem:(key,value)=>source.setItem(prefix+key,value),removeItem:key=>source.removeItem(prefix+key)}}
    function exceeds(source,limit){for(const key of guardedKeys){const text=source.getItem(key);if(text===null)continue;try{const pending=[JSON.parse(text)];let seen=0;while(pending.length){if(++seen>100000)return true;const item=pending.pop();if(!item||typeof item!=='object')continue;if((item.session?.steps??0)>limit)return true;for(const value of Object.values(item)){if(value&&typeof value==='object')pending.push(value);else if(typeof value==='string'&&(value[0]==='{'||value[0]==='[')){try{pending.push(JSON.parse(value))}catch{}}}}}catch{/* Existing C5 conflict handling keeps invalid data. */}}return false}
    const pendingKey='lambda-hub-long-start-pending-v1';
    function hasSavedData(storage){return guardedKeys.some(key=>storage.getItem(key)!==null)}
    function selectWorkspace(source){
      let active=source,prefix='',previous=null,index=0;
      // Continue a workspace created by the old 256-step guard instead of
      // silently switching back to an older original session.
      while(index<16&&exceeds(active,256)){
        const nextPrefix=prefixBase+index+'.',next=scope(source,nextPrefix);
        if(!hasSavedData(next))break;
        previous=active;active=next;prefix=nextPrefix;index++;
      }
      let pending=null;try{pending=JSON.parse(source.getItem(pendingKey)||'null')}catch{}
      const interrupted=pending?.prefix===prefix;
      if(exceeds(active,4294967296)||interrupted){
        for(;index<16;index++){
          const nextPrefix=prefixBase+index+'.',next=scope(source,nextPrefix);
          if(!hasSavedData(next))return {storage:next,safe:true,prefix:nextPrefix,previous:active,timedOut:true};
        }
        return {storage:unavailable,safe:true,prefix:'',previous:active,overflow:true,timedOut:true};
      }
      const choice={storage:active,safe:!!prefix,prefix,previous};
      if(exceeds(active,256)){
        try{const token=String(Date.now())+'-'+Math.random();source.setItem(pendingKey,JSON.stringify({prefix,token}));choice.pendingToken=token;}
        catch{return {storage:unavailable,safe:true,prefix:'',previous:active,overflow:true,timedOut:true};}
      }
      return choice;
    }
    const normalRaw=backing||unavailable,choice=selectWorkspace(normalRaw),raw=choice.storage;
    const mappedEvents=choice.safe?{addEventListener(type,listener){root.addEventListener(type,event=>{if(event.key===null)listener({key:null});else if(event.key.startsWith(choice.prefix))listener({key:event.key.slice(choice.prefix.length),oldValue:event.oldValue,newValue:event.newValue})})}}:root;
