(function(){
  'use strict';
  const script=document.currentScript, game=script&&script.dataset.game;
  if(!/^[a-z][a-z0-9-]{0,31}$/.test(game||''))throw Error('Game storage identity unavailable');
  const prefix='game-hub-pages.v1.'+game+'.';
  function scoped(native){
    const keys=()=>{const a=[];for(let i=0;i<native.length;i++){const k=native.key(i);if(k!==null&&k.startsWith(prefix))a.push(k.slice(prefix.length));}return a;};
    const api={getItem:k=>native.getItem(prefix+String(k)),setItem:(k,v)=>native.setItem(prefix+String(k),String(v)),removeItem:k=>native.removeItem(prefix+String(k)),clear:()=>{for(const k of keys())native.removeItem(prefix+k);},key:i=>keys()[Number(i)]??null};
    return new Proxy(api,{get(target,key){if(key==='length')return keys().length;if(typeof key==='symbol')return Reflect.get(target,key);return key in target?target[key]:api.getItem(key);},set(_target,key,value){api.setItem(key,value);return true;},deleteProperty(_target,key){api.removeItem(key);return true;},ownKeys(){return keys();},getOwnPropertyDescriptor(_target,key){const value=api.getItem(key);return value===null?undefined:{value,writable:true,enumerable:true,configurable:true};},has(_target,key){return key in api||api.getItem(key)!==null;}});
  }
  const nativeLocal=window.localStorage,nativeSession=window.sessionStorage,local=scoped(nativeLocal),session=scoped(nativeSession);
  Object.defineProperty(window,'localStorage',{configurable:false,get:()=>local});Object.defineProperty(window,'sessionStorage',{configurable:false,get:()=>session});
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),wrappers=new WeakMap();
  window.addEventListener=function(type,listener,options){if(type!=='storage'||!listener)return add(type,listener,options);let wrapper=wrappers.get(listener);if(!wrapper){wrapper=function(event){if(event.key!==null&&!event.key.startsWith(prefix))return;const area=event.storageArea===nativeLocal?local:event.storageArea===nativeSession?session:event.storageArea;const mapped=new Proxy(event,{get(target,key){if(key==='key')return target.key===null?null:target.key.slice(prefix.length);if(key==='storageArea')return area;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});if(typeof listener==='function')listener.call(window,mapped);else listener.handleEvent(mapped);};wrappers.set(listener,wrapper);}return add(type,wrapper,options);};
  window.removeEventListener=function(type,listener,options){return remove(type,type==='storage'&&listener?wrappers.get(listener)||listener:listener,options);};
  if(window.indexedDB){const db=window.indexedDB,open=db.open.bind(db),del=db.deleteDatabase.bind(db),list=typeof db.databases==='function'?db.databases.bind(db):null;const isolated=new Proxy(db,{get(target,key){if(key==='open')return (name,...args)=>open(prefix+String(name),...args);if(key==='deleteDatabase')return (name,...args)=>del(prefix+String(name),...args);if(key==='databases'&&list)return async()=> (await list()).filter(x=>x.name?.startsWith(prefix)).map(x=>({...x,name:x.name.slice(prefix.length)}));const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});Object.defineProperty(window,'indexedDB',{configurable:false,get:()=>isolated});}
})();
