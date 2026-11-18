import {TYPES,isExpression} from './blocks.js';
import {getList,listIndex} from './lists.js';
export const numeric=value=>{const n=Number(value);if(!Number.isFinite(n))throw new Error('运算需要有限数值');return n;};
export const truth=value=>!(value===false||value===0||value===''||value==='0'||String(value).toLowerCase()==='false');
export function evaluate(value,context={},depth=0){
  if(!isExpression(value))return value;
  if(depth>=8||!Object.hasOwn(TYPES,value.type)||!TYPES[value.type].reporter)throw new Error('无效的返回值积木');
  const e=v=>evaluate(v,context,depth+1),n=v=>numeric(e(v));
  const state=context.state||{},sense=context.sensing?.()||{},variables=state.variables||new Map();
  const compare=(a,b)=>{const x=Number(a),y=Number(b);return typeof a!=='boolean'&&typeof b!=='boolean'&&a!==''&&b!==''&&Number.isFinite(x)&&Number.isFinite(y)?[x,y]:[String(a),String(b)];};
  let result;
  switch(value.type){
    case 'xPosition':return state.x||0;case 'yPosition':return state.y||0;case 'direction':return state.angle||0;case 'spriteSize':return state.size??100;
    case 'volume':return state.volume??80;
    case 'costumeNumber':return (context.costumes||['fox','rabbit','robot']).indexOf(state.costume)+1;
    case 'backdropNumber':return (context.backdrops||['meadow','space','paper']).indexOf(state.backdrop)+1;
    case 'mouseX':return sense.mouseX||0;case 'mouseY':return sense.mouseY||0;case 'mouseDown':return !!sense.mouseDown;
    case 'touchingEdge':return Math.abs(state.x||0)>=240||Math.abs(state.y||0)>=180;
    case 'keyPressed':return sense.keys?.has(value.key) || false;
    case 'timer':return Math.max(0,(context.clock?.()||0)-(state.timerStart||0));
    case 'variable':if(!variables.has(value.name))throw new Error('变量不存在：'+value.name);return variables.get(value.name);
    case 'listLength':return getList(state,value.name).length;
    case 'listItem':{const items=getList(state,value.name);return items[listIndex(e(value.index),items.length)];}
    case 'argument':if(!context.inCall)throw new Error('参数积木只能在自制积木调用中使用');return context.argument;
    case 'parameter':if(!context.inCall||context.definitionId!==value.definitionId||!context.parameters?.has(value.parameterId))throw new Error('参数只能在所属自制积木内使用');return context.parameters.get(value.parameterId);
    case 'add':result=n(value.a)+n(value.b);break;case 'subtract':result=n(value.a)-n(value.b);break;case 'multiply':result=n(value.a)*n(value.b);break;
    case 'divide':{const b=n(value.b);if(b===0)throw new Error('不能除以 0');result=n(value.a)/b;break;}
    case 'mod':{const b=n(value.b);if(b===0)throw new Error('不能对 0 取余');result=((n(value.a)%b)+b)%b;break;}
    case 'random':{const x=n(value.a),y=n(value.b),lo=Math.min(x,y),hi=Math.max(x,y),r=Math.min(0.999999999,Math.max(0,(context.random||Math.random)()));return Number.isInteger(lo)&&Number.isInteger(hi)?Math.floor(r*(hi-lo+1))+lo:lo+r*(hi-lo);}
    case 'greater':{const [a,b]=compare(e(value.a),e(value.b));return a>b;}case 'less':{const [a,b]=compare(e(value.a),e(value.b));return a<b;}
    case 'equals':{const [a,b]=compare(e(value.a),e(value.b));return a===b;}
    case 'and':return truth(e(value.a))&&truth(e(value.b));case 'or':return truth(e(value.a))||truth(e(value.b));case 'not':return !truth(e(value.value));
    case 'round':result=Math.round(n(value.value));break;case 'abs':result=Math.abs(n(value.value));break;
    case 'join':return (String(e(value.a))+String(e(value.b))).slice(0,80);case 'length':return [...String(e(value.value))].length;
    default:throw new Error('未知运算');
  }
  if(!Number.isFinite(result))throw new Error('运算结果超出有限数值范围');return result;
}
