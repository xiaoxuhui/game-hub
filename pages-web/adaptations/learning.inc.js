  {
    const key='game-hub-web-autosave-v1',keys=Object.keys(model);let writable=true;
    const warn=text=>{let node=document.getElementById('hub-save-warning');if(!node){node=document.createElement('p');node.id='hub-save-warning';node.setAttribute('role','alert');document.querySelector('main').prepend(node)}node.textContent=text};
    const finite=n=>typeof n==='number'&&Number.isFinite(n),integer=n=>Number.isSafeInteger(n)&&n>0&&n<=20000,vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(finite);
    function valid(m){
      if(!m||!integer(m.inputSize)||!integer(m.outputSize)||!Array.isArray(m.architecture)||!m.architecture.length||m.architecture.length>32||!m.architecture.every(integer)||!Array.isArray(m.layers)||m.layers.length!==m.architecture.length+1||!Array.isArray(m.samples)||m.samples.length>32||!Array.isArray(m.trials)||!Array.isArray(m.shapeHistory)||m.shapeHistory.length>10||typeof m.structureMode!=='string'||m.structureMode.length>256||(m.structureMode!=='auto'&&!/^[1-9]\d*(?:-[1-9]\d*)*$/.test(m.structureMode)))return false;
      const sizes=[m.inputSize,...m.architecture,m.outputSize];let parameters=0;for(let i=0;i<m.layers.length;i++){const layer=m.layers[i],a=sizes[i],b=sizes[i+1];parameters+=(a+1)*b;if(parameters>20000||!layer||!vector(layer.biases,b)||!Array.isArray(layer.weights)||layer.weights.length!==b||!layer.weights.every(row=>vector(row,a)))return false}
      if(!vector(m.inputScales,m.inputSize)||!vector(m.outputScales,m.outputSize)||m.inputScales.some(n=>n<=0)||m.outputScales.some(n=>n<=0)||!m.samples.every(s=>Array.isArray(s)&&s.length===2&&vector(asArray(s[0]),m.inputSize)&&vector(asArray(s[1]),m.outputSize)))return false;
      if(!Number.isSafeInteger(m.epochs)||m.epochs<0||!Number.isSafeInteger(m.lastRounds)||m.lastRounds<0||!finite(m.sx)||!finite(m.sy)||!(m.loss===null||finite(m.loss))||!(m.normalizedLoss===null||finite(m.normalizedLoss)))return false;
      const decision=d=>d&&typeof d==='object'&&Array.isArray(d.from)&&d.from.every(integer)&&Array.isArray(d.to)&&d.to.every(integer)&&typeof d.action==='string'&&typeof d.mode==='string';
      return (m.decision===null||decision(m.decision))&&m.shapeHistory.every(decision)&&m.trials.every(t=>t&&Array.isArray(t.architecture)&&t.architecture.every(integer)&&finite(t.normalizedLoss)&&finite(t.parameterCount));
    }
    let drafts=null;try{const text=localStorage.getItem(key);if(text!==null){if(text.length>2*1024*1024)throw Error('large');const saved=JSON.parse(text);if(saved.version!==1||!valid(saved.model)||!saved.drafts||typeof saved.drafts!=='object')throw Error('invalid');for(const name of keys){if(!Object.hasOwn(saved.model,name))throw Error('missing');model[name]=saved.model[name]}traceX=unpack(Array(model.inputSize).fill(0));drafts=saved.drafts}}catch{model.reset();writable=false;warn('本地存档无法读取，已保留原数据，请先从大厅导出备份。')}
    const fields=()=>Array.from(document.querySelectorAll('#train-form input[id],#predict-form input[id],#network-config input[id],#trace-form input[id]'));
    const save=()=>{if(!writable)return;try{const values={};for(const input of fields())values[input.id]=input.value;localStorage.setItem(key,JSON.stringify({version:1,model,drafts:values}))}catch{writable=false;warn('无法保存进度，请检查浏览器存储空间并导出备份。')}};
    for(const type of ['click','input','change','submit'])document.addEventListener(type,save);window.addEventListener('pagehide',save);
    if(drafts)queueMicrotask(()=>{for(const input of fields())if(typeof drafts[input.id]==='string'&&drafts[input.id].length<=10000)input.value=drafts[input.id]});
  }
