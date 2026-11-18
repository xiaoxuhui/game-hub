/* Build replaces snake-speed with the fixed game identity. */
(function(){'use strict';const prefix='game-hub-pages.v1.snake-speed.';if(!self.indexedDB)return;const db=self.indexedDB,open=db.open.bind(db),del=db.deleteDatabase.bind(db),list=typeof db.databases==='function'?db.databases.bind(db):null;const isolated=new Proxy(db,{get(target,key){if(key==='open')return (name,...args)=>open(prefix+String(name),...args);if(key==='deleteDatabase')return (name,...args)=>del(prefix+String(name),...args);if(key==='databases'&&list)return async()=> (await list()).filter(x=>x.name?.startsWith(prefix)).map(x=>({...x,name:x.name.slice(prefix.length)}));const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});Object.defineProperty(self,'indexedDB',{configurable:false,get:()=>isolated});})();

// A real CPython interpreter in a separate worker: Stop can terminate even an infinite loop.
const BASE=new URL('pyodide/', import.meta.url).href;
let pyodide,runId=0,sequence=0,latestState='{}',active=false,nonCommandBytes=0;
const requests=new Map(),outstanding=new Set();
let commandError=null;
const send=(type,data={})=>self.postMessage({type,runId,...data});
function request(type,data={}) {
  if(requests.size>=2048)throw new Error('待执行指令过多。请在循环里加入 await wait()，或使用新版 Chrome / Edge。');
  const id=++sequence;
  const promise=new Promise((resolve,reject)=>requests.set(id,{resolve,reject}));
  promise.catch(()=>{});send(type,{id,...data});return promise;
}
const bridge={
  has_sync:typeof WebAssembly.Suspending==='function',
  line(text) {
    text=String(text);
    const command=/^[WASDTR]$/.test(text.trim())?text.trim():null;
    if(!command){nonCommandBytes+=text.length;if(nonCommandBytes>200000)throw new Error('普通输出超过 200000 字符，请减少输出。');}
    send('stdout',{text,command});
    if(!command)return null;
    const promise=request('command',{command});outstanding.add(promise);
    promise.then(()=>outstanding.delete(promise),error=>{outstanding.delete(promise);commandError=error;});
    return promise;
  },
  async drain() {
    while(outstanding.size)await Promise.all([...outstanding]);
    if(commandError){const error=commandError;commandError=null;throw error;}
  },
  clear_error(){commandError=null;},
  async state(){return request('state');},
  cached_state(){return latestState;},
  sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
};
const BOOTSTRAP=String.raw`
import sys as _sys, io as _io, json as _json, time as _time
from pyodide.ffi import run_sync as _run_sync
import snake_bridge as _bridge

class _GameOutput:
    encoding = "utf-8"
    errors = "strict"
    def __init__(self):
        self.buffer = ""
    def write(self, text):
        if not isinstance(text, str):
            raise TypeError("write() argument must be str")
        self.buffer += text
        if len(self.buffer) > 200000:
            raise RuntimeError("单行输出过长，请减少输出。")
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            self._emit(line)
        return len(text)
    def _emit(self, line):
        pending = _bridge.line(line)
        if line.strip() in ("W", "A", "S", "D", "T", "R") and _bridge.has_sync:
            try:
                _run_sync(pending)
            except Exception as error:
                _bridge.clear_error()
                raise RuntimeError(str(error)) from None
    def flush(self):
        if self.buffer:
            line, self.buffer = self.buffer, ""
            self._emit(line)
    def isatty(self):
        return False

_sys.stdout = _GameOutput()
_sys.stdin = _io.StringIO(_stdin_text)

async def wait():
    """等待已经输出的移动指令执行完成。"""
    await _bridge.drain()

def get_state():
    """读取 head、snake、food、size、score、speed、status。"""
    if _bridge.has_sync:
        return _json.loads(_run_sync(_bridge.state()))
    return _json.loads(_bridge.cached_state())

async def get_state_async():
    return _json.loads(await _bridge.state())

if not hasattr(_time, "_snake_native_sleep"):
    _time._snake_native_sleep = _time.sleep
def _game_sleep(seconds):
    if seconds < 0:
        raise ValueError("sleep length must be non-negative")
    if _bridge.has_sync:
        _run_sync(_bridge.sleep(float(seconds) * 1000))
    else:
        _time._snake_native_sleep(seconds)
_time.sleep = _game_sleep
`;
async function boot() {
  send('loading');
  try {
    const {loadPyodide}=await import(BASE+'pyodide.js');
    pyodide=await loadPyodide({indexURL:BASE,packages:['pydoc_data'],
      stdout:text=>send('system',{text}),stderr:text=>send('stderr',{text})});
    pyodide.registerJsModule('snake_bridge',bridge);
    send('ready',{version:pyodide.runPython('import sys; sys.version.split()[0]')});
  }catch(error){send('boot-error',{message:String(error)});}
}
self.onmessage=async event=>{
  const message=event.data;
  if(message.type==='response') {
    if(message.runId!==runId)return;
    const pending=requests.get(message.id);if(!pending)return;requests.delete(message.id);
    if(message.error)pending.reject(new Error(message.error));
    else{latestState=JSON.stringify(message.state);pending.resolve(latestState);}
    return;
  }
  if(message.type!=='run'||active||!pyodide)return;
  active=true;runId=message.runId;latestState=JSON.stringify(message.state);nonCommandBytes=0;commandError=null;
  let namespace;
  try {
    send('running');pyodide.setStderr({batched:text=>send('stderr',{text})});
    namespace=pyodide.toPy({__name__:'__main__',_stdin_text:message.stdin||''});
    await pyodide.runPythonAsync(BOOTSTRAP,{globals:namespace});
    await pyodide.loadPackagesFromImports(message.code,{messageCallback:text=>send('system',{text}),errorCallback:text=>send('stderr',{text})});
    const result=await pyodide.runPythonAsync(message.code,{globals:namespace,filename:'我的贪吃蛇.py'});
    result?.destroy?.();
    await pyodide.runPythonAsync('_sys.stdout.flush()',{globals:namespace});await bridge.drain();send('done');
  }catch(error){send('error',{message:String(error)});}
  finally{active=false;namespace?.destroy();}
};
boot();
