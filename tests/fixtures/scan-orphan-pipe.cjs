const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{detached:true,stdio:'inherit',windowsHide:true});
child.unref();
