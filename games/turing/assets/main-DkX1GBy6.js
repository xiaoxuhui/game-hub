import{T as ie,a as je,p as re,i as le,b as Be,h as Me,s as Ne,t as Pe,e as ze}from"./core-BmS44wlX.js";const Xe=["<","=",">"].flatMap((e,t)=>{const n=`cmp.result${t}`;return[...["1","X","Y","?"].map(a=>`${n},${a} -> ${n},${a},R`),`${n},□ -> ${n}.erase,□,L`,...["1","X","Y","?"].map(a=>`${n}.erase,${a} -> ${n}.erase,□,L`),`${n}.erase,□ -> ${n}.write,□,R`,`${n}.write,□ -> HALT,${e},N`]}).join(`
`),Oe={unaryAdd:{name:"一进制加法",category:"一进制运算",description:"格式 1^a+1^b：111+11 表示 3+2，结果 11111。空操作数表示 0，例如 +11；空纸带结果表示 0。",input:"111+11",initialState:"add.scan",blankSymbol:"□",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`add.scan,1 -> add.scan,1,R
add.scan,+ -> add.end,1,R
add.end,1 -> add.end,1,R
add.end,□ -> add.trim,□,L
add.trim,1 -> HALT,□,N`},unarySubtract:{name:"一进制减法",category:"一进制运算",description:"格式 1^a-1^b：11111-11 表示 5−2，结果 111。空操作数表示 0；相减为 0 时纸带为空；a<b 时进入 REJECT（负结果）。",input:"11111-11",initialState:"sub.seek",blankSymbol:"□",acceptStates:"",rejectStates:"REJECT",haltStates:"HALT",rules:`sub.seek,1 -> sub.seek,1,R
sub.seek,- -> sub.pick,-,R
sub.pick,Y -> sub.pick,Y,R
sub.pick,1 -> sub.back,Y,L
sub.pick,□ -> sub.erase,□,L
sub.back,Y -> sub.back,Y,L
sub.back,- -> sub.take,-,L
sub.take,X -> sub.take,X,L
sub.take,1 -> sub.return,X,R
sub.take,□ -> REJECT,□,N
sub.return,X -> sub.return,X,R
sub.return,- -> sub.pick,-,R
sub.erase,Y -> sub.erase,□,L
sub.erase,- -> sub.clean,□,L
sub.clean,X -> sub.clean,□,L
sub.clean,1 -> sub.clean,1,L
sub.clean,□ -> HALT,□,N`},unaryMultiply:{name:"一进制乘法",category:"一进制运算",description:"格式 1^a*1^b：111*11 表示 3×2。逐次复制得到 111111，结果留在原输入右侧，操作数和标记清除；任一空操作数表示乘以 0。",input:"111*11",initialState:"mul.init",blankSymbol:"□",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`mul.init,1 -> mul.init,1,R
mul.init,* -> mul.init,*,R
mul.init,□ -> mul.rewind,=,L
mul.rewind,1 -> mul.rewind,1,L
mul.rewind,* -> mul.rewind,*,L
mul.rewind,□ -> mul.pickA,□,R
mul.pickA,X -> mul.pickA,X,R
mul.pickA,1 -> mul.seek,X,R
mul.pickA,* -> mul.cleanLeft,*,L
mul.seek,1 -> mul.seek,1,R
mul.seek,X -> mul.seek,X,R
mul.seek,* -> mul.pickB,*,R
mul.pickB,Y -> mul.pickB,Y,R
mul.pickB,1 -> mul.end,Y,R
mul.pickB,= -> mul.restore,=,L
mul.end,1 -> mul.end,1,R
mul.end,Y -> mul.end,Y,R
mul.end,= -> mul.end,=,R
mul.end,□ -> mul.back,1,L
mul.back,1 -> mul.back,1,L
mul.back,Y -> mul.back,Y,L
mul.back,= -> mul.back,=,L
mul.back,* -> mul.pickB,*,R
mul.restore,Y -> mul.restore,1,L
mul.restore,* -> mul.backA,*,L
mul.backA,1 -> mul.backA,1,L
mul.backA,X -> mul.backA,X,L
mul.backA,□ -> mul.pickA,□,R
mul.cleanLeft,X -> mul.cleanLeft,X,L
mul.cleanLeft,□ -> mul.clean,□,R
mul.clean,X -> mul.clean,□,R
mul.clean,1 -> mul.clean,□,R
mul.clean,* -> mul.clean,□,R
mul.clean,= -> HALT,□,R`},unaryCompare:{name:"一进制大小比较",category:"一进制运算",description:"格式 1^a?1^b：111?11 比较 3 和 2，结果为 >。逐对匹配，最后只留下 <、= 或 >；空操作数表示 0。",input:"111?11",initialState:"cmp.pick",blankSymbol:"□",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`cmp.pick,X -> cmp.pick,X,R
cmp.pick,1 -> cmp.seek,X,R
cmp.pick,? -> cmp.rest,?,R
cmp.seek,1 -> cmp.seek,1,R
cmp.seek,X -> cmp.seek,X,R
cmp.seek,? -> cmp.right,?,R
cmp.right,Y -> cmp.right,Y,R
cmp.right,1 -> cmp.back,Y,L
cmp.right,□ -> cmp.result2,□,N
cmp.back,1 -> cmp.back,1,L
cmp.back,X -> cmp.back,X,L
cmp.back,Y -> cmp.back,Y,L
cmp.back,? -> cmp.back,?,L
cmp.back,□ -> cmp.pick,□,R
cmp.rest,Y -> cmp.rest,Y,R
cmp.rest,1 -> cmp.result0,1,N
cmp.rest,□ -> cmp.result1,□,N
${Xe}`},unaryEven:{name:"一进制整除判断（÷2）",category:"一进制运算",description:"输入 n 个 1 表示 n，例如 1111 表示 4。每读一个 1 切换奇偶状态：能被 2 整除则 ACCEPT，否则 REJECT；空串表示 0，可被 2 整除。原输入保留。",input:"1111",initialState:"even",blankSymbol:"□",acceptStates:"ACCEPT",rejectStates:"REJECT",haltStates:"",rules:`even,1 -> odd,1,R
odd,1 -> even,1,R
even,□ -> ACCEPT,□,N
odd,□ -> REJECT,□,N`}};function _(e,t,n,a=!1){const i=n.split("_").flatMap((l,o)=>{const s=String.fromCharCode(65+o);return l.match(/\d[LR][A-Z]/g).map((p,u)=>`${s},${u} -> ${p[2]==="Z"?"HALT":p[2]},${p[0]},${p[1]}`)}).join(`
`);return{name:e,category:"忙碌海狸",description:`从全 0 空纸带出发，状态数不含停机态，符号数含空白 0。${t}`,input:"",initialState:"A",blankSymbol:"0",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:i,...a?{maxSteps:null}:{}}}const He={beaver3Steps:_("3 状态 2 符号忙碌海狸（步数冠军）","运行 21 步，留下 5 个 1。","1RB1RZ_1LB0RC_1LC1LA"),beaver3Ones:_("3 状态 2 符号忙碌海狸（写 1 冠军）","运行 14 步，留下 6 个 1。它与步数冠军不是同一台机器。","1RB1RZ_0RC1RB_1LC1LA"),beaver4:_("4 状态 2 符号忙碌海狸","运行 107 步，留下 13 个 1。","1RB1LB_1LA0LC_1RZ1LD_1RD0RA"),beaver23:_("2 状态 3 符号忙碌海狸","字母表 0、1、2，运行 38 步，留下 9 个非空格。","1RB2LB1RZ_2LA2RB1LB"),beaver24:_("2 状态 4 符号忙碌海狸（长运行）","字母表 0、1、2、3，运行 3,932,964 步，留下 2050 个非空格；自动开启 Max，在 1000 步/秒下约需 66 分钟。","1RB2LA1RA1RA_1LB1LA3RB1RZ",!0)};function Ye(){const e=[];for(let t=0;t<=100;t+=1){e.push(`GB.input.${t},1 -> ${t<100?`GB.input.${t+1}`:"REJECT"},1,${t<100?"R":"N"}`);const n=t>=4&&t%2===0;e.push(`GB.input.${t},□ -> ${n?"GB.rewind":"REJECT"},□,${n?"L":"N"}`)}e.push(`GB.rewind,1 -> GB.rewind,1,L
GB.rewind,□ -> GB.first,□,R
GB.first,1 -> GB.second,1,R
GB.second,1 -> GB.insert,1,R
GB.insert,1 -> GB.shift,+,R
GB.shift,1 -> GB.shift,1,R
GB.shift,□ -> GB.restart,1,L
GB.restart,1 -> GB.restart,1,L
GB.restart,+ -> GB.restart,+,L
GB.restart,□ -> GB.P.2.c0,□,R
GB.fail,1 -> GB.fail,1,L
GB.fail,+ -> GB.movePlus,1,R
GB.movePlus,1 -> GB.restart,+,L
GB.movePlus,□ -> REJECT,□,N`);for(const t of["P","Q"])for(let n=2;n<=10;n+=1){const a=`GB.${t}.${n}`,i=t==="P"?"+":"□",l=(o,s)=>{s?e.push(`${o},${i} -> GB.fail,${i},${t==="P"?"N":"L"}`):n<10?e.push(`${o},${i} -> ${a}.rewind,${i},L`):e.push(`${o},${i} -> ${t==="P"?"GB.Q.2.c0":"ACCEPT"},${i},${t==="P"?"R":"N"}`)};for(let o=0;o<=n;o+=1){const s=`${a}.c${o}`;e.push(`${s},1 -> ${a}.${o<n?`c${o+1}`:"r1"},1,R`),l(s,o<2)}for(let o=0;o<n;o+=1){const s=`${a}.r${o}`;e.push(`${s},1 -> ${a}.r${(o+1)%n},1,R`),l(s,o===0)}n<10&&(e.push(`${a}.rewind,1 -> ${a}.rewind,1,L`),e.push(`${a}.rewind,${t==="P"?"□":"+"} -> GB.${t}.${n+1}.c0,${t==="P"?"□":"+"},R`))}return e.join(`
`)}function Ie(){const e=[`C.check,1 -> C.single,1,R
C.check,0 -> REJECT,0,N
C.check,□ -> REJECT,□,N
C.single,□ -> ACCEPT,□,N
C.single,0 -> C.end,0,N
C.single,1 -> C.end,1,N
C.end,0 -> C.end,0,R
C.end,1 -> C.end,1,R
C.end,□ -> C.parity,□,L
C.parity,0 -> C.rewind,□,L
C.parity,1 -> C.add.0.1,1,N
C.rewind,0 -> C.rewind,0,L
C.rewind,1 -> C.rewind,1,L
C.rewind,□ -> C.check,□,R
C.prefix,□ -> C.rewind,1,L`];for(const t of[0,1])for(const n of[0,1]){const a=`C.add.${t}.${n}`;for(const l of[0,1]){const o=l+t+n;e.push(`${a},${l} -> C.add.${l}.${Math.floor(o/2)},${o%2},L`)}const i=t+n;e.push(`${a},□ -> ${i===2?"C.prefix":"C.rewind"},${i===0?"□":i%2},${i===0?"N":"L"}`)}return e.join(`
`)}const De={goldbach:{name:"哥德巴赫验证（单个偶数 ≤100）",category:"猜想验证",description:"输入 n 个 1 表示一个 4–100 的偶数，如 1111111111 表示 10。机器实际试除并搜索素数分拆，接受后输出 1^p+1^q（如 111+1111111）。无效输入拒绝。仅验证给定输入，不证明整个猜想。",input:"1111111111",initialState:"GB.input.0",blankSymbol:"□",acceptStates:"ACCEPT",rejectStates:"REJECT",haltStates:"",rules:Ye()},collatz:{name:"考拉兹验证（3n+1，二进制）",category:"猜想验证",description:"输入无前导 0 的正整数二进制，左边是高位，例如 110 表示 6。偶数除 2，奇数乘 3 加 1；到达 1 时 ACCEPT。0 和空输入拒绝。仅验证此起点，达到步数上限只表示暂停，不能当作反例或全体证明。",input:"110",initialState:"C.check",blankSymbol:"□",acceptStates:"ACCEPT",rejectStates:"REJECT",haltStates:"",rules:Ie()}};function qe(e,t,n,a,i){if(!Number.isInteger(n)||n<2||a<0||a>=n||!e.has(t))throw new Error("无效寄存器程序");if(!["/","^","^^","^^^","+"].includes(i))throw new Error("不支持的输入分隔符");for(const c of e.values()){if("register"in c&&(!Number.isInteger(c.register)||c.register<0||c.register>=n))throw new Error("寄存器越界");if((c.kind==="dec"?[c.positive,c.zero]:"next"in c?[c.next]:[]).some(m=>!e.has(m)))throw new Error("跳转目标不存在")}const l=["# 一进制寄存器程序展开为普通单纸带规则；运行时才计算数值。","# 输入右侧清空；左侧 | 分隔寄存器、# 为原点；停机后只留下答案。"],o=new Set,s=(c,d,m,b=d,v="N")=>{const H=`${c},${d}`;if(o.has(H))throw new Error(`重复编译规则：${H}`);o.add(H),l.push(`${c},${d} -> ${m},${b},${v}`)},p=new Map,u=c=>{const d=p.get(c);if(d)return d;const m=`return.${p.size}`;p.set(c,m);for(const b of["1","|","□"])s(m,b,m,b,"R");return s(m,"#",c),m},h=(c,d)=>{const m=`${c}.op`;s(c,"#",d?`${c}.seek${d}`:m,"#","L");for(let b=d;b>0;b-=1){const v=`${c}.seek${b}`;s(v,"1",v,"1","L"),s(v,"|",b===1?m:`${c}.seek${b-1}`,"|","L")}return m},$=(c,d,m)=>{const b=h(c,d);s(b,"1",b,"1","L"),s(b,"|",`${c}.carryBar`,"1","L");for(const v of["1","|"]){const H=`${c}.carry${v==="1"?"One":"Bar"}`;for(const de of["1","|"])s(H,de,`${c}.carry${de==="1"?"One":"Bar"}`,v,"L");s(H,"□",u(m),v,"R")}};for(const[c,d]of e){const m=`I.${c}`;if(d.kind==="inc")$(m,d.register,`I.${d.next}`);else if(d.kind==="dec"){const b=h(m,d.register);s(b,"|",u(`I.${d.zero}`)),s(b,"1",`${m}.take`,"□","L");for(const v of["1","|"])s(`${m}.take`,v,`${m}.put${v==="1"?"One":"Bar"}`,"□","R"),s(`${m}.put${v==="1"?"One":"Bar"}`,"□",`${m}.skipHole`,v,"L");s(`${m}.skipHole`,"□",`${m}.take`,"□","L"),s(`${m}.take`,"□",u(`I.${d.positive}`),"□","R")}else d.kind==="jump"?s(m,"#",`I.${d.next}`):s(m,"#",d.kind==="halt"?"clean.0.0":"REJECT","#",d.kind==="halt"?"L":"N")}const f=["1","0","+","-","*","/","^","?","□","#","|","a","b"];for(const c of f)s("BOOT",c,"init.fence",c,"L");s("init.fence","□","init.0","#","L");for(let c=0;c<n;c+=1)s(`init.${c}`,"□",c===n-1?"init.back":`init.${c+1}`,"|",c===n-1?"R":"L");s("init.back","|","init.back","|","R"),s("init.back","#","validate.a","#","R");const w=(c,d)=>{for(const m of f){const[b,v]=d[m]??["REJECT","N"];s(c,m,b,m,v)}};w("validate.a",{1:["validate.a","R"],[i[0]]:[i.length===1?"validate.b":"validate.op1","R"]});for(let c=1;c<i.length;c+=1)w(`validate.op${c}`,{[i[c]]:[c===i.length-1?"validate.b":`validate.op${c+1}`,"R"]});w("validate.b",{1:["validate.b","R"],"□":["validate.rewind","L"]});for(const c of["1",i[0]])s("validate.rewind",c,"validate.rewind",c,"L");s("validate.rewind","#","parse.A");for(const[c,d]of[["A",0],["B",1]]){s(`parse.${c}`,"#",`parse.scan${c}`,"#","R"),s(`parse.scan${c}`,"1",`parse.seek${c}`,c.toLowerCase(),"L");for(const m of["1","a","b",i[0]])s(`parse.seek${c}`,m,`parse.seek${c}`,m,"L");s(`parse.seek${c}`,"#",`parse.inc${c}`),$(`parse.inc${c}`,d,`parse.${c}`)}s("parse.scanA","a","parse.scanA","a","R"),s("parse.scanA",i[0],"parse.scanB");for(const c of["a","b",i[0]])s("parse.scanB",c,"parse.scanB",c,"R");s("parse.scanB","□","parse.erase","□","L");for(const c of["a","b",i[0]])s("parse.erase",c,"parse.erase","□","L");s("parse.erase","#",`I.${t}`);for(let c=0;c<n;c+=1)for(const d of[0,1]){const m=`clean.${c}.${d}`;s(m,"1",`clean.${c}.${d||c===a?1:0}`,c===a?"1":"□","L"),s(m,"|",c===n-1?`clean.return.${d}`:`clean.${c+1}.${d}`,"□","L")}for(const c of[0,1]){const d=`clean.return.${c}`;for(const m of["1","□"])s(d,m,d,m,"R");s(d,"#",c?"clean.find":"HALT","□",c?"L":"N")}return s("clean.find","□","clean.find","□","L"),s("clean.find","1","clean.start","1","L"),s("clean.start","1","clean.start","1","L"),s("clean.start","□","HALT","□","R"),l.join(`
`)}class fe{instructions=new Map([["done",{kind:"halt"}],["reject",{kind:"reject"}]]);registers=3;labels=0;label(){return`p${this.labels++}`}register(){return this.registers++}inc(t,n){const a=this.label();return this.instructions.set(a,{kind:"inc",register:t,next:n}),a}dec(t,n,a,i){this.instructions.set(t,{kind:"dec",register:n,positive:a,zero:i})}clear(t,n){const a=this.label();return this.dec(a,t,a,n),a}move(t,n,a){const i=this.label();return this.dec(i,t,this.inc(n,i),a),i}copy(t,n,a,i){const l=this.label(),o=this.move(a,t,i);return this.dec(l,t,this.inc(n,this.inc(a,l)),o),this.clear(n,l)}one(t,n){return this.clear(t,this.inc(t,n))}multiply(t,n,a,i){const l=this.register(),o=this.register(),s=this.register(),p=this.label(),u=this.label();return this.dec(u,o,this.inc(a,u),p),this.dec(p,l,this.copy(n,o,s,u),i),this.clear(a,this.copy(t,l,s,p))}hyper(t,n,a,i,l){if(t===2)return this.multiply(n,a,i,l);const o=this.register(),s=this.register(),p=this.register(),u=this.label(),h=this.clear(i,this.move(p,i,u)),$=this.hyper(t-1,n,i,p,h);return this.dec(u,o,$,l),this.one(i,this.copy(a,o,s,u))}positive(t,n){const a=this.label();return this.dec(a,t,this.inc(t,n),"reject"),a}}function he(e,t,n,a,i,l){return{category:"一进制运算",name:e,input:n,initialState:"BOOT",blankSymbol:"□",acceptStates:"",rejectStates:"REJECT",haltStates:"HALT",maxSteps:null,description:`${t} 两侧用 1 的个数表示数值，空串表示 0。工作区在原点左侧，停机后只留下答案的 1；规则全部由读写头执行，默认 Max，仍可暂停或设置步数上限。`,rules:qe(i.instructions,l,i.registers,2,a)}}function Je(){const e=new fe,t=e.register(),n=e.register(),a=e.label(),i=e.label(),l=e.label();e.dec(l,0,i,"done"),e.dec(i,t,l,e.inc(2,a)),e.instructions.set(a,{kind:"jump",next:e.copy(1,t,n,i)});const o=e.positive(1,e.clear(2,a));return he("一进制除法（取商）","1111111/11 表示 7÷2，得到 111（取整商 3，舍去余数）；除数为 0 进入 REJECT。","1111111/11","/",e,o)}function ee(e,t,n,a,i){const l=new fe;let o=l.hyper(e,0,1,2,"done");return e>=4&&(o=l.positive(0,o)),he(t,a,i,n,l,o)}const _e={unaryDivide:Je(),unaryPower:ee(3,"一进制乘方（幂）","^","111^11 表示 3²，得到 9 个 1。指数为 0 得 1，本示例约定 0^0=1。","111^11"),unaryTetration:ee(4,"一进制超幂（幂塔）","^^","11^^111 表示 2↑↑3=2^(2^2)=16，幂塔从右向左结合。底数须≥1，高度 0 得 1。默认 2↑↑2=4；2↑↑4 已有 65536 个 1，逐步运行非常慢。","11^^11"),unaryPentation:ee(5,"一进制超超幂","^^^","11^^^11 表示 2↑↑↑2=2↑↑2=4；递推 a↑↑↑(n+1)=a↑↑(a↑↑↑n)。底数须≥1，次数 0 得 1。2↑↑↑3=65536，计算步数远大于答案长度，请从小数开始。","11^^^11")},D={unary:{category:"一进制运算",name:"一进制加一",description:"越过所有 1，在末尾写入一个 1。",input:"111",initialState:"q0",blankSymbol:"□",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`q0,1 -> q0,1,R
q0,□ -> HALT,1,N`},binary:{category:"基础示例",name:"二进制加一",description:"先移动到最右端，再从低位处理进位。",input:"1011",initialState:"scan",blankSymbol:"□",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`scan,0 -> scan,0,R
scan,1 -> scan,1,R
scan,□ -> carry,□,L
carry,0 -> HALT,1,N
carry,1 -> carry,0,L
carry,□ -> HALT,1,N`},palindrome:{category:"基础示例",name:"二进制回文判断",description:"逐次标记两端字符；进入 ACCEPT 或 REJECT。",input:"1001",initialState:"start",blankSymbol:"□",acceptStates:"ACCEPT",rejectStates:"REJECT",haltStates:"",rules:`start,X -> start,X,R
start,Y -> start,Y,R
start,0 -> seek0,X,R
start,1 -> seek1,Y,R
start,□ -> ACCEPT,□,N
seek0,0 -> seek0,0,R
seek0,1 -> seek0,1,R
seek0,X -> seek0,X,R
seek0,Y -> seek0,Y,R
seek0,□ -> check0,□,L
check0,0 -> back,X,L
check0,X -> check0,X,L
check0,Y -> check0,Y,L
check0,1 -> REJECT,1,N
check0,□ -> ACCEPT,□,N
seek1,0 -> seek1,0,R
seek1,1 -> seek1,1,R
seek1,X -> seek1,X,R
seek1,Y -> seek1,Y,R
seek1,□ -> check1,□,L
check1,1 -> back,Y,L
check1,X -> check1,X,L
check1,Y -> check1,Y,L
check1,0 -> REJECT,0,N
check1,□ -> ACCEPT,□,N
back,0 -> back,0,L
back,1 -> back,1,L
back,X -> back,X,L
back,Y -> back,Y,L
back,□ -> start,□,R`},beaver:{category:"忙碌海狸",name:"2 状态忙碌海狸",description:"从空纸带出发，执行 6 步后留下 4 个 1。",input:"",initialState:"A",blankSymbol:"0",acceptStates:"",rejectStates:"",haltStates:"HALT",rules:`A,0 -> B,1,R
A,1 -> B,1,L
B,0 -> A,1,L
B,1 -> HALT,1,R`},...Oe,..._e,...He,...De};function be(e){return JSON.stringify([e.input,e.blankSymbol,e.initialState,e.acceptStates,e.rejectStates,e.haltStates,e.rules])}function Fe(e,t,n){return!e||t!==n}function We(e){return JSON.stringify([e.currentState,e.headPosition,e.tape.entries()])}function j(e,t,n){return`${e}:${t}:${n}`}function Ue(e,t,n=12,a=2){const i=new ie(e,t),l=[],o=new Map;let s=null,p="step-limit";for(let d=0;d<=n;d+=1){const m=We(i),b=o.get(m);if(b!==void 0){s={start:b,length:d-b};break}if(o.set(m,d),l.push({state:i.currentState,head:i.headPosition,cells:i.tape.entries()}),d===n)break;const v=i.step();if(v.stopped){p=v.reason,l.push({state:i.currentState,head:i.headPosition,cells:i.tape.entries()});break}}const u=l.flatMap(d=>[d.head,...d.cells.map(([m])=>m)]),h=Math.min(0,...u)-a,f=Math.max(0,...u)+a-h+1,w=l.length,c=[];for(let d=0;d<w;d+=1){const m=new Map(l[d].cells);for(let b=0;b<f;b+=1){const v=h+b;c.push({id:`t-${d}-${b}`,row:d,column:b,symbol:m.get(v)??e.blankSymbol,state:l[d].head===v?l[d].state:null,isHead:l[d].head===v,top:d===0?j("border-top",0,b):j("time",d-1,b),bottom:d===w-1?j("border-bottom",d,b):j("time",d,b),left:b===0?j("border-left",d,0):j("space",d,b-1),right:b===f-1?j("border-right",d,b):j("space",d,b)})}}return{rows:w,columns:f,minPosition:h,tiles:c,solution:c.map(d=>d.id),loop:s,stopReason:p}}function Ze(e,t,n,a){const i=e.tiles.find(f=>f.id===a);if(!i||t.includes(a)||n<0||n>=t.length)return!1;const l=Math.floor(n/e.columns),o=n%e.columns,s=f=>e.tiles.find(w=>w.id===t[f]),p=l>0?s(n-e.columns):void 0,u=o>0?s(n-1):void 0,h=l<e.rows-1?s(n+e.columns):void 0,$=o<e.columns-1?s(n+1):void 0;return(!p||p.bottom===i.top)&&(!u||u.right===i.left)&&(!h||h.top===i.bottom)&&(!$||$.left===i.right)}function ge(e,t){return t.length===e.solution.length&&t.every((n,a)=>n===e.solution[a])}function Ve(e,t){let n=!1,a=0,i=0;e.addEventListener("pointerdown",o=>{if(t.isEnabled()){if(n=!0,a=o.clientX,i=t.getScroll(),e.classList.add("dragging"),document.body.classList.add("tape-dragging"),typeof e.setPointerCapture=="function")try{e.setPointerCapture(o.pointerId)}catch{}o.preventDefault()}}),e.addEventListener("pointermove",o=>{if(!n)return;const s=t.getPitch();if(s<=0)return;const p=o.clientX-a;t.setScroll(je(i,p,s));const u=p-Math.round(p/s)*s;t.applyShift(u)});const l=()=>{n&&(n=!1,t.applyShift(0),e.classList.remove("dragging"),document.body.classList.remove("tape-dragging"))};e.addEventListener("pointerup",l),e.addEventListener("pointercancel",l)}function Ke(e,t){return{width:Math.min(1600,Math.max(320,t*10)),height:Math.min(2400,Math.max(180,e))}}function ue(e,t,n){return n<=1||t<=1?0:Math.min(n-1,Math.floor(e*n/t))}function Qe(e,t=1e4){return!Number.isFinite(e)||e<1?t:Math.min(Number.MAX_SAFE_INTEGER,Math.floor(e))}function oe(e){return Number.isFinite(e)?Math.min(1e3,Math.max(1,Math.round(e))):5}function et(e,t){return e<=0||t<=0?0:e*1e3/t}function Se(e,t){const n=oe(t);e.slider.value=String(n),e.number.value=String(n),e.text.textContent=`${n} 步/秒`}function tt(e,t=()=>{}){const n=a=>{Se(e,a),t(Number(e.slider.value))};e.slider.addEventListener("input",()=>n(Number(e.slider.value))),e.number.addEventListener("input",()=>n(Number(e.number.value)))}function nt(e,t,n,a=250){const i=e+Math.max(0,t)*oe(n)/1e3,l=Math.min(a,Math.floor(i));return{due:l,credit:i-l}}class at{constructor(t,n=()=>performance.now()){this.callbacks=t,this.now=n}callbacks;now;timer=null;startedAt=0;lastTickAt=0;completed=0;credit=0;get running(){return this.timer!==null}start(){this.running||(this.startedAt=this.now(),this.lastTickAt=this.startedAt,this.completed=0,this.credit=0,this.callbacks.onTick(0),this.timer=window.setInterval(()=>this.tick(),16))}stop(){this.timer!==null&&window.clearInterval(this.timer),this.timer=null}tick(){if(!this.running)return;const t=this.now(),n=nt(this.credit,t-this.lastTickAt,this.callbacks.getTargetSpeed());this.credit=n.credit,this.lastTickAt=t;const a=n.due>0?this.callbacks.executeBatch(n.due):{executed:0,keepRunning:!0};this.completed+=a.executed;const i=et(this.completed,t-this.startedAt);a.keepRunning||this.stop(),this.callbacks.onTick(i)}}class st{constructor(t,n){this.createWorker=t,this.callbacks=n}createWorker;callbacks;worker=null;get running(){return this.worker!==null}start(t){this.cleanup(this.worker);const n=this.createWorker();this.worker=n,this.callbacks.onStart(t.maxSteps),n.onmessage=a=>{if(n===this.worker){if(a.data.type==="progress"){this.callbacks.onProgress(a.data.step,a.data.maxSteps);return}if(a.data.type==="error"){this.callbacks.onError(a.data.message||"未知后台错误"),this.cleanup(n);return}a.data.type==="complete"&&(this.callbacks.onComplete(a.data),this.cleanup(n))}},n.onerror=()=>{n===this.worker&&(this.callbacks.onError("Worker 意外停止，可重新生成。"),this.cleanup(n))},n.postMessage(t)}cancel(){this.worker&&(this.cleanup(this.worker),this.callbacks.onCancel())}cleanup(t){!t||t!==this.worker||(t.onmessage=null,t.onerror=null,t.terminate(),this.worker=null)}}function it(e,t=120){return e.slice(-t).reverse().map(n=>({step:`#${n.step}`,detail:`${n.fromState},${n.readSymbol} → ${n.toState},${n.writeSymbol},${n.direction}　[${n.headBefore}→${n.headAfter}]`}))}function rt(e,t){e.replaceChildren();const n=it(t);if(!n.length){const a=document.createElement("div");a.className="empty",a.textContent="单步或运行后，这里会显示执行过程",e.append(a);return}for(const a of n){const i=document.createElement("div");i.className="log-row";const l=document.createElement("span"),o=document.createElement("span");l.textContent=a.step,o.textContent=a.detail,i.append(l,o),e.append(i)}}const lt=["name","description","input","blankSymbol","initialState","acceptStates","rejectStates","haltStates","rules"];function ot(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function ct(e){if(!ot(e))throw new Error("项目内容必须是 JSON 对象");if(e.format!=="turing-machine-simulator")throw new Error("不是图灵机实验台项目");if(e.version!==1)throw new Error("仅支持项目格式版本 1");for(const a of lt)if(typeof e[a]!="string")throw new Error(`字段 ${a} 必须是文本`);if(e.maxSteps!==null&&(!Number.isSafeInteger(e.maxSteps)||e.maxSteps<1||e.maxSteps>1e6))throw new Error("最大步数必须是 1–1000000 的整数，或设为 Max");if(!Number.isFinite(e.speed)||e.speed<1||e.speed>1e3)throw new Error("目标速度必须在 1–1000 步/秒之间");const t=e;if(!t.initialState.trim())throw new Error("初始状态不能为空");if(Array.from(t.blankSymbol).length!==1)throw new Error("空白符必须是一个字符");const n=re(t.rules);if(n.errors.length)throw new Error(n.errors.slice(0,4).join("；"));return new ie({blankSymbol:t.blankSymbol,initialState:t.initialState.trim(),acceptStates:te(t.acceptStates),rejectStates:te(t.rejectStates),haltStates:te(t.haltStates),transitions:n.transitions},[]),{...t}}function te(e){return e.split(",").map(t=>t.trim()).filter(Boolean)}function dt(e,t=Math.random){const n=[...e];for(let a=n.length-1;a>0;a-=1){const i=t(),l=Number.isFinite(i)?Math.min(Math.max(i,0),1-Number.EPSILON):0,o=Math.floor(l*(a+1));[n[a],n[o]]=[n[o],n[a]]}return n}const Y=1,F=2,I=4,W=8,R=(e,t=0)=>t===0?String(e):`${e}|${[Y,F,I,W].map((n,a)=>t&n?"OSAB"[a]:"").join("")}`;function ut(e){if(!Number.isSafeInteger(e)||e<0)throw new Error("请输入大于或等于 0 的整数阈值。");if(e>16)throw new Error("本次转换支持 0–16 的阈值；更大阈值会生成过大的规则表。");const t=[`# Gijswijt threshold=${e}`,"# 0=未写入；数字=数列项；|O/S/A/B=计算标记；#数字=本轮最大重复次数","# 转换仅展开规则；数列项由图灵机运行时比较后缀计算。"],n=new Set,a=(s,p,u,h=p,$="N")=>{const f=`${s},${p}`;if(n.has(f))throw new Error(`编译器产生重复规则：${f}`);n.add(f),t.push(`${s},${p} -> ${u},${h},${$}`)},i=[];for(let s=1;s<=e;s+=1)for(let p=0;p<16;p+=1)i.push({digit:s,flags:p,text:R(s,p)});const l=(s,p)=>{for(const u of i)p(u)},o=(s,p,u=s)=>l(s,h=>a(s,h.text,u,h.text,p));if(a("G.seed","0",e===0?"G.HALT":"G.fence","1",e===0?"N":"L"),e>0){a("G.fence","0","G.end","#1","R"),o("G.end","R"),a("G.end","0","G.origin","0","L"),a("G.next","0","G.origin","0","L"),l("G.origin",s=>a("G.origin",s.text,"G.trial",R(s.digit,s.flags|Y))),l("G.trial",s=>{s.flags&Y&&a("G.trial",s.text,"G.markB",R(s.digit,s.flags|F),"L")}),l("G.markB",s=>a("G.markB",s.text,"G.endA",R(s.digit,s.flags|W),"R"));for(let s=1;s<=e;s+=1)a("G.markB",`#${s}`,"G.cleanL.1");o("G.endA","R"),a("G.endA","0","G.markA","0","L"),l("G.markA",s=>a("G.markA",s.text,"G.compare.1",R(s.digit,s.flags|I)));for(let s=1;s<=e;s+=1){const p=`G.compare.${s}`;l(p,u=>{u.flags&I&&a(p,u.text,`G.findB.${s}.${u.digit}.${u.flags&F?1:0}`,u.text,"L")});for(let u=1;u<=e;u+=1)for(const h of[0,1]){const $=`G.findB.${s}.${u}.${h}`;l($,f=>{if(!(f.flags&W))a($,f.text,$,f.text,"L");else if(f.digit!==u)a($,f.text,`G.cleanL.${s}`);else if(h&&s===e)a($,f.text,"G.stopL");else{const w=s+h,c=f.flags&~W|(h?F:0);a($,f.text,`G.moveB.${w}.${h}`,R(f.digit,c),"L")}})}for(const u of[0,1]){const h=`G.moveB.${s}.${u}`;l(h,f=>a(h,f.text,`G.returnA.${s}.${u}`,R(f.digit,f.flags|W),"R"));for(let f=1;f<=e;f+=1)a(h,`#${f}`,`G.cleanL.${s}`);const $=`G.returnA.${s}.${u}`;l($,f=>{f.flags&I?a($,f.text,`G.moveA.${s}`,R(f.digit,f.flags&~I&(u?~F:-1)),"L"):a($,f.text,$,f.text,"R")})}l(`G.moveA.${s}`,u=>a(`G.moveA.${s}`,u.text,p,R(u.digit,u.flags|I))),o(`G.cleanL.${s}`,"L");for(let u=1;u<=e;u+=1)a(`G.cleanL.${s}`,`#${u}`,"G.cleanR",`#${Math.max(u,s)}`,"R")}l("G.cleanR",s=>a("G.cleanR",s.text,"G.cleanR",R(s.digit,s.flags&Y),"R")),a("G.cleanR","0","G.findO","0","L"),l("G.findO",s=>{s.flags&Y?a("G.findO",s.text,"G.shiftO",R(s.digit),"L"):a("G.findO",s.text,"G.findO",s.text,"L")}),l("G.shiftO",s=>a("G.shiftO",s.text,"G.trial",R(s.digit,Y)));for(let s=1;s<=e;s+=1)a("G.shiftO",`#${s}`,`G.append.${s}`,"#1","R"),o(`G.append.${s}`,"R"),a(`G.append.${s}`,"0","G.next",String(s),"R"),a("G.stopL",`#${s}`,"G.stopR","0","R");o("G.stopL","L"),l("G.stopR",s=>a("G.stopR",s.text,"G.stopR",R(s.digit),"R")),a("G.stopR","0","G.HALT",String(e+1))}return{format:"turing-machine-simulator",version:1,name:`吉斯维杰特数列（超过 ${e} 停机）`,description:"单纸带规则逐格比较重复后缀；0 表示未写入。",input:"",blankSymbol:"0",initialState:"G.seed",acceptStates:"",rejectStates:"",haltStates:"G.HALT",maxSteps:null,speed:1e3,rules:t.join(`
`)}}function pt(e){return e.entries().filter(([t])=>t>=0).map(([,t])=>Number(t.split("|")[0]))}function pe(e,t,n){let a=0;return e.split(/\r?\n/).flatMap(i=>!i.trim()||i.trimStart().startsWith("#")?[i]:a++!==t?[i]:n===null?[]:[n]).join(`
`)}function mt(e){const t=s=>e.querySelector(`#${s}`);let n=[1],a=null;const i=()=>{t("directOutput").value=n.join(", ");const s=Math.max(0,n.length-40);t("directTape").innerHTML=[...n.slice(s),...Array(10).fill(0)].map((p,u)=>`<div class="sequence-cell${p===0?" unwritten":""}"><small>${s+u+1}</small><strong>${p}</strong></div>`).join(""),t("directStatus").textContent=`已写入 ${n.length} 项，最新项 ${n.at(-1)}${a?"；生成中，可随时取消或切换模式。":"。"}`},l=()=>{a?.terminate(),a=null,t("directCancel").disabled=!0,t("directNext").disabled=!1,t("directGenerate").disabled=!1},o=s=>{if(!Number.isSafeInteger(s)||s<n.length||s<1){t("directStatus").textContent=`目标项数须为不小于 ${n.length} 的正整数。`;return}if(s===n.length){i();return}l();try{const p=new Worker(new URL(""+new URL("gijswijt-worker-BVTAjsju.js",import.meta.url).href,import.meta.url),{type:"module"});a=p,t("directCancel").disabled=!1,t("directNext").disabled=!0,t("directGenerate").disabled=!0;const u=()=>{a===p&&(l(),t("directStatus").textContent="计算中断，已写入项保留，可继续生成。")};p.onmessage=h=>{if(a===p)if(h.data.type==="progress"){for(const $ of h.data.terms)n.push($);i()}else h.data.type==="done"?(l(),i()):h.data.type==="error"&&u()},p.onerror=u,p.postMessage({sequence:[...n],targetLength:s}),i()}catch{l(),t("directStatus").textContent="无法启动直接计算，请重试。"}};t("directNext").addEventListener("click",()=>o(n.length+1)),t("directGenerate").addEventListener("click",()=>o(Number(t("directTarget").value))),t("directCancel").addEventListener("click",()=>{l(),i()}),t("directReset").addEventListener("click",()=>{l(),n=[1],i()}),i()}const $e="turing-machine-simulator.speed.v1";function ft(e){try{const t=e.getItem($e);if(t===null||t.trim()==="")return null;const n=Number(t);return Number.isInteger(n)&&n>=1&&n<=1e3?n:null}catch{return null}}function ht(e,t){try{return e.setItem($e,String(oe(t))),null}catch{return"无法保存目标速度；当前页调速仍可使用。"}}let g=null,z=[],G="就绪",q="",ke=null,k=null,y=[],O=null,C=!1,ve=[],X=0,x=0;const ne=100;let B=null,M=null;const bt={format:"turing-machine-simulator",version:1,maxSteps:1e4,speed:5,...D.unary};document.querySelector("#app").innerHTML=`
  <div class="app">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">TM</div><div><h1>图灵机实验台</h1><p>单纸带 · 确定性 · 可编程</p></div></div>
      <div class="toolbar">
        <a class="campaign-link" href="./campaign.html">进入关卡</a>
        <button id="exportProject">导出项目</button>
        <button id="importProject">导入项目</button>
        <input id="fileInput" type="file" accept="application/json,.json" hidden />
        <button id="exportLog">导出记录</button>
      </div>
    </header>
    <main class="workspace">
      <section class="panel machine-panel">
        <div class="status-row">
          <div class="metric"><span>运行状态</span><strong id="status" class="status-pill">就绪</strong></div>
          <div class="metric"><span>当前状态</span><strong id="currentState">—</strong></div>
          <div class="metric"><span>读取符号</span><strong id="readSymbol">—</strong></div>
          <div class="metric"><span>读写头位置</span><strong id="headPosition">0</strong></div>
          <div class="metric"><span>已执行步数</span><strong id="stepCount">0</strong></div>
        </div>
        <div class="tape-shell"><div id="tape" class="tape"></div><div id="headState" class="head-state"></div></div>
        <div class="controls">
          <button id="step" class="btn">单步</button>
          <button id="run" class="btn primary">运行</button>
          <button id="pause" class="btn">暂停</button>
          <button id="reset" class="btn">重置</button>
          <label class="view-mode">纸带视角<select id="tapeViewMode"><option value="follow-head">跟随读写头</option><option value="fixed-zero">固定在 0</option><option value="free-drag">随意拖动</option></select></label>
          <div class="speed"><span>目标速度</span><input id="speed" type="range" min="1" max="1000" value="5" /><input id="speedNumber" type="number" min="1" max="1000" step="1" value="5" title="手动输入目标速度（步/秒）" /><span id="speedText">5 步/秒</span><strong id="actualSpeed">实际 0 步/秒</strong></div>
        </div>
      </section>
      <section class="panel gijswijt-converter" aria-labelledby="gijswijtTitle">
        <div class="sequence-mode-bar"><h2 id="gijswijtTitle">吉斯维杰特数列</h2><label for="sequenceMode">计算模式<select id="sequenceMode"><option value="tm">图灵机计算 · 规则与单步</option><option value="direct">直接计算 · 快速生成</option></select></label></div>
        <div id="tmSequenceMode">
        <div class="converter-heading">
          <div><p>输入阈值，转换后的规则会显示在下方。点击上方“运行”开始计算；新项严格超过阈值时写出并停机，等于时继续。</p></div>
          <div class="converter-actions"><label for="gijswijtThreshold">整数阈值（0–16）<input id="gijswijtThreshold" type="number" min="0" max="16" step="1" value="2" /></label><button id="compileGijswijt" class="btn primary">开始转换</button></div>
        </div>
        <p class="hint">0 表示未写入；数字表示数列项。计算时 |O、S、A、B 为比较标记，#数字记录本轮最大重复次数，停机时会清除。建议先试 2；阈值越大，运行可能极长。</p>
        <p id="gijswijtCompileStatus" class="converter-status" role="status"></p>
        <div id="gijswijtResult" hidden><label for="gijswijtOutput">已写入的数列（直接读取纸带）</label><textarea id="gijswijtOutput" readonly rows="3" spellcheck="false"></textarea><p id="gijswijtOutputStatus" class="hint" aria-live="polite"></p></div>
        </div>
        <div id="directSequenceMode" hidden>
          <div class="converter-heading"><p>按最大重复后缀的定义快速生成数列。切换模式会保留当前页中两种模式各自的进度。</p></div>
          <div class="direct-actions"><button id="directNext" class="btn">写入下一项</button><label for="directTarget">生成到第几项<input id="directTarget" type="number" min="1" step="1" value="30" /></label><button id="directGenerate" class="btn primary">批量生成</button><button id="directCancel" class="btn" disabled>取消</button><button id="directReset" class="btn">重置数列</button></div>
          <p id="directStatus" class="converter-status" role="status"></p>
          <div id="directTape" class="sequence-tape" aria-label="直接计算的数列纸带"></div>
          <p class="hint">0 = 尚未写入；正整数 = 数列项。纸带显示最新 40 项，完整数列见下方。</p>
          <label for="directOutput">完整数列</label><textarea id="directOutput" readonly rows="3" spellcheck="false"></textarea>
        </div>
      </section>
      <div class="lower">
        <section class="panel editor">
          <div class="panel-title"><h2>机器定义</h2><small>每行一条规则：状态,符号 → 状态,符号,方向</small></div>
          <div class="form-grid">
            <label>初始输入<input id="input" /></label>
            <label>空白符<input id="blankSymbol" maxlength="2" /></label>
            <label>初始状态<input id="initialState" /></label>
            <div class="step-limit-field"><label for="maxSteps">最大步数</label><div class="step-limit-control"><input id="maxSteps" type="number" min="1" max="1000000" /><label class="max-steps-option"><input id="unlimitedSteps" type="checkbox" /> Max</label></div></div>
            <label>接受状态<input id="acceptStates" placeholder="逗号分隔" /></label>
            <label>拒绝状态<input id="rejectStates" placeholder="逗号分隔" /></label>
            <label>普通停机状态<input id="haltStates" placeholder="逗号分隔" /></label>
          </div>
          <label>转移规则<textarea id="rules" spellcheck="false"></textarea></label>
          <div class="table-heading"><strong>结构化规则表</strong><button id="addRule" class="btn">＋ 新增规则</button></div>
          <div id="ruleTable" class="rule-table"></div>
          <div class="rule-pagination"><span id="rulePageInfo"></span><button id="rulePrev" class="btn">上一页</button><button id="ruleNext" class="btn">下一页</button></div>
          <div class="editor-actions"><button id="apply" class="btn primary">应用并重置</button><button id="clear" class="btn danger">清空规则</button><span id="errors" class="error"></span></div>
          <div class="hint">快捷键：空格运行/暂停，Alt + → 单步，Ctrl + R 重置（输入框聚焦时不触发）。</div>
        </section>
        <aside class="side">
          <section class="panel">
            <div class="panel-title"><h2>示例程序</h2><small>${Object.keys(D).length} 个</small></div>
            <select id="example" style="width:100%">
              ${["一进制运算","基础示例","忙碌海狸","猜想验证"].map(e=>`<optgroup label="${e}">${Object.entries(D).filter(([,t])=>t.category===e).map(([t,n])=>`<option value="${t}">${n.name}</option>`).join("")}</optgroup>`).join("")}
            </select>
            <p id="exampleNote" class="example-note"></p>
            <button id="loadExample" class="btn" style="width:100%">加载此示例</button>
          </section>
          <section class="panel">
            <div class="panel-title"><h2>执行记录</h2><small id="stopMessage"></small></div>
            <div id="log" class="log"></div>
          </section>
        </aside>
      </div>
      <section class="panel route-panel">
        <div class="route-heading">
          <div><h2>全路线总览</h2><p>后台计算整段运行轨迹并压缩成一张时空图；生成时仍可继续使用上面的模拟器和瓷砖游戏。</p></div>
          <div class="route-actions"><label>运行步数<input id="routeSteps" type="number" min="1" step="1" value="10000" /></label><button id="generateRoute" class="btn primary">后台生成</button><button id="cancelRoute" class="btn" disabled>取消</button></div>
        </div>
        <div class="route-progress"><progress id="routeProgress" max="100" value="0"></progress><span id="routeStatus">等待生成</span></div>
        <div class="route-legend"><span class="legend-head"></span>读写头 <span class="legend-written"></span>非空纸带 <span class="legend-empty"></span>空白；纵向为时间，横向为纸带位置</div>
        <div class="route-canvas-shell"><canvas id="routeCanvas" width="900" height="260"></canvas><div id="routeEmpty">输入步数后点击“后台生成”</div></div>
      </section>
      <section class="panel puzzle-panel">
        <div class="puzzle-heading">
          <div><h2>计算瓷砖拼图</h2><p>每一行是一个时刻；相邻边必须同色。点击或拖动瓷砖，把它放入上方空格。</p></div>
          <div class="puzzle-actions"><label>生成步数<input id="puzzleSteps" type="number" min="1" max="30" value="10" /></label><button id="generatePuzzle" class="btn primary">生成瓷砖</button><button id="checkPuzzle" class="btn">检查拼法</button><button id="showSolution" class="btn">查看正确拼法</button></div>
        </div>
        <div id="cycleInfo" class="cycle-info">应用一台图灵机后生成瓷砖。</div>
        <div class="puzzle-scroll"><div id="puzzleBoard" class="puzzle-board"></div></div>
        <h3 class="tray-title">待拼瓷砖 <small>点击一块，再点击空格；也支持拖放</small></h3>
        <div id="tileTray" class="tile-tray"></div>
        <div id="puzzleMessage" class="puzzle-message" aria-live="polite"></div>
      </section>
    </main>
  </div>`;const L=globalThis.installTuringCompatibility(globalThis,{validateProjectData:ct},bt),r=e=>document.getElementById(e),S=e=>r(e).value,ae=e=>e.split(",").map(t=>t.trim()).filter(Boolean);mt(r("directSequenceMode"));r("sequenceMode").addEventListener("change",()=>{const e=S("sequenceMode")==="direct";r("tmSequenceMode").hidden=e,r("directSequenceMode").hidden=!e});function E(){return L.collect({format:"turing-machine-simulator",version:1,name:"自定义图灵机",description:"用户编辑的图灵机项目",input:S("input"),blankSymbol:S("blankSymbol")||"□",initialState:S("initialState"),acceptStates:S("acceptStates"),rejectStates:S("rejectStates"),haltStates:S("haltStates"),rules:S("rules"),maxSteps:r("unlimitedSteps").checked?null:Number(S("maxSteps"))||1e4,speed:Number(S("speed"))||5})}function Q(e){if(!L.beforeReplace(e))return!1;const t=["input","blankSymbol","initialState","acceptStates","rejectStates","haltStates","rules"];for(const i of t)r(i).value=e[i];const n=e.maxSteps===void 0?1e4:e.maxSteps,a=n===null;return r("unlimitedSteps").checked=a,r("maxSteps").value=String(n===null?L.displayLimit():n),r("maxSteps").disabled=a,"speed"in e&&(r("speed").value=String(e.speed)),vt(),Ge(Number(S("speed"))),!0}function A(){T();const e=E(),t=re(e.rules),n=[...t.errors];if(e.initialState.trim()||n.unshift("初始状态不能为空"),e.blankSymbol||n.unshift("空白符不能为空"),Array.from(e.blankSymbol).length!==1&&n.unshift("空白符必须是一个字符"),r("errors").textContent=n.slice(0,4).join("；"),n.length)return!1;const a={blankSymbol:e.blankSymbol,initialState:e.initialState.trim(),acceptStates:ae(e.acceptStates),rejectStates:ae(e.rejectStates),haltStates:ae(e.haltStates),transitions:t.transitions};try{g=new ie(a,le(e.input,e.blankSymbol))}catch(o){return r("errors").textContent=o instanceof Error?o.message:"无法创建机器",!1}z=[];const i=e.initialState==="G.seed"&&e.blankSymbol==="0"?e.rules.slice(0,100).match(/^# Gijswijt threshold=(\d+)$/m):null;B=i?Number(i[1]):null,B!==null&&(r("gijswijtThreshold").value=String(B)),X=0,M=null,ke=be(e),G="就绪",q="";const l=L.save(e);return l&&(r("errors").textContent=l),N(),J(),ye(),!0}function V(e){let t=0;for(const n of e)t=t*31+n.charCodeAt(0)>>>0;return`hsl(${t%360} 62% 48%)`}function me(e){const t=k?.tiles.find(a=>a.id===e);if(!t)return"";const n=t.state?`${t.state} · ${t.symbol}`:t.symbol;return`<div class="wang-tile${t.state?" head-tile":""}" draggable="true" data-tile-id="${t.id}" title="${P(n)}">
    <i class="edge edge-top" style="background:${V(t.top)}"></i><i class="edge edge-right" style="background:${V(t.right)}"></i>
    <i class="edge edge-bottom" style="background:${V(t.bottom)}"></i><i class="edge edge-left" style="background:${V(t.left)}"></i>
    <span>${t.state?`<b>${P(t.state)}</b>`:""}${P(t.symbol)}</span></div>`}function Z(){const e=r("puzzleBoard"),t=r("tileTray");if(!k){e.innerHTML="",t.innerHTML="";return}e.style.gridTemplateColumns=`repeat(${k.columns}, 62px)`,e.innerHTML=y.map((a,i)=>`<button class="tile-slot${C?" solution-slot":""}" data-slot="${i}" aria-label="第 ${Math.floor(i/k.columns)+1} 行第 ${i%k.columns+1} 列">${a?me(a):`<span>${i%k.columns+k.minPosition}</span>`}</button>`).join("");const n=ve.map(a=>k.tiles.find(i=>i.id===a)).filter(a=>!y.includes(a.id));t.innerHTML=n.map(a=>`<button class="tray-tile${O===a.id?" selected":""}" data-select-tile="${a.id}">${me(a.id)}</button>`).join("")||'<div class="empty">所有瓷砖都已放到棋盘</div>'}function Le(e,t){if(!k||C)return;const n=y[e];if(!Ze(k,y,e,t)){r("puzzleMessage").textContent="这块瓷砖与已放置的相邻边不匹配，或已经使用过。";return}n&&(y[e]=null),y[e]=t,O=null,r("puzzleMessage").textContent=ge(k,y)?"完成！这张铺法逐行复现了图灵机的计算历史。":"已放置。",Z()}function ye(){if(!g)return;const e=Math.min(30,Math.max(1,Number(S("puzzleSteps"))||10));k=Ue(g.definition,le(S("input"),g.definition.blankSymbol),e,1),y=Array(k.solution.length).fill(null),O=null,C=!1,ve=dt(k.solution);const t=k.loop?`发现循环：从第 ${k.loop.start} 步开始，周期 ${k.loop.length} 步。`:`未发现循环；计算结果：${K[k.stopReason]??`到达 ${e} 步上限`}。`;r("cycleInfo").textContent=`${t} 棋盘 ${k.rows} × ${k.columns}，共 ${k.tiles.length} 块。`,r("showSolution").textContent="查看正确拼法",r("puzzleMessage").textContent="瓷砖已打乱。先找带状态名的读写头瓷砖。",Z()}function gt(e,t,n){const a=r("routeCanvas"),i=n-t+1,l=Ke(e.length,i);a.width=l.width,a.height=l.height;const o=a.getContext("2d");o.fillStyle="#f4f7fa",o.fillRect(0,0,a.width,a.height);for(let s=0;s<a.height;s+=1){const p=e[ue(s,a.height,e.length)],u=new Set(p.cells.map(([h])=>h));for(let h=0;h<a.width;h+=1){const $=t+ue(h,a.width,i);if($===p.head)o.fillStyle="#ef476f";else if(u.has($))o.fillStyle="#168963";else continue;o.fillRect(h,s,1,1)}}r("routeEmpty").hidden=!0}const Re=new st(()=>new Worker(new URL(""+new URL("route-worker--cIr4Dp-.js",import.meta.url).href,import.meta.url),{type:"module"}),{onStart:e=>{r("generateRoute").disabled=!0,r("cancelRoute").disabled=!1,r("routeProgress").value=0,r("routeStatus").textContent=`后台计算中：0 / ${e} 步`},onProgress:(e,t)=>{r("routeProgress").value=e/t*100,r("routeStatus").textContent=`后台计算中：${e} / ${t} 步（你可以继续玩）`},onComplete:({frames:e,min:t,max:n,reason:a})=>{gt(e,t,n),r("routeProgress").value=100,r("routeStatus").textContent=`已显示 ${e.length} 个时刻，纸带位置 ${t}…${n}，结束原因：${K[a]??"达到步数上限"}`,r("generateRoute").disabled=!1,r("cancelRoute").disabled=!0},onError:e=>{r("routeStatus").textContent=`后台生成失败：${e}`,r("generateRoute").disabled=!1,r("cancelRoute").disabled=!0},onCancel:()=>{r("generateRoute").disabled=!1,r("cancelRoute").disabled=!0,r("routeStatus").textContent="后台生成已取消；当前模拟器状态不受影响。"}});function St(){if(!g)return;const e=Qe(Number(S("routeSteps")));r("routeSteps").value=String(e),Re.start({definition:g.definition,initialTape:le(S("input"),g.definition.blankSymbol),maxSteps:e})}function we(){const e=r("tape");e.replaceChildren();const t=g?.headPosition??0,n=S("tapeViewMode"),a=Pe(n,t)+ze(n,X);e.classList.toggle("can-drag",n==="free-drag");for(let i=a-8;i<=a+8;i+=1){const l=document.createElement("div");l.className=`cell${i===t?" head":""}`,l.innerHTML=`<span class="cell-index">${i}</span>`;const o=document.createElement("span");o.textContent=g?.tape.read(i)??S("blankSymbol")??"□",l.append(o),e.append(l)}if(!Be(a,t)){const i=document.createElement("div"),l=t<a;i.className=`head-offscreen ${l?"left":"right"}`,i.textContent=l?`← 读写头在 ${t}`:`读写头在 ${t} →`,e.append(i)}if(n==="follow-head"){if(M!==null&&a!==M){const i=Me(M,a,xe()),l=Ne(Number(S("speed")));e.style.transition="none",e.style.transform=`translateX(${i}px)`,e.offsetWidth,e.style.transition=`transform ${l}ms ease-out`,e.style.transform="translateX(0)"}M=a}else M=a,e.style.transition="none"}function xe(){const e=r("tape").querySelectorAll(".cell");if(e.length>=2){const t=Math.abs(e[1].getBoundingClientRect().left-e[0].getBoundingClientRect().left);if(t>0)return t}return 58}function $t(){rt(r("log"),z)}function J(){const e=r("ruleTable"),t=re(S("rules"));if(t.errors.length){e.innerHTML='<div class="empty">修正文本规则后即可同步结构化表格</div>',r("rulePageInfo").textContent="规则格式待修正",r("rulePrev").disabled=!0,r("ruleNext").disabled=!0;return}const n=Math.max(1,Math.ceil(t.transitions.length/ne));x=Math.min(x,n-1);const a=x*ne;r("rulePageInfo").textContent=`共 ${t.transitions.length} 条 · 第 ${x+1}/${n} 页`,r("rulePrev").disabled=x===0,r("ruleNext").disabled=x===n-1,e.innerHTML='<div class="rule-row rule-head"><span>当前状态</span><span>读取</span><span>下一状态</span><span>写入</span><span>移动</span><span></span></div>'+t.transitions.slice(a,a+ne).map((i,l)=>{const o=a+l;return`<div class="rule-row rule-data-row" data-index="${o}">
      <input aria-label="规则 ${o+1} 当前状态" value="${P(i.fromState)}" />
      <input aria-label="规则 ${o+1} 读取符号" value="${P(i.readSymbol)}" />
      <input aria-label="规则 ${o+1} 下一状态" value="${P(i.toState)}" />
      <input aria-label="规则 ${o+1} 写入符号" value="${P(i.writeSymbol)}" />
      <select aria-label="规则 ${o+1} 移动方向"><option${i.direction==="L"?" selected":""}>L</option><option${i.direction==="R"?" selected":""}>R</option><option${i.direction==="N"?" selected":""}>N</option></select>
      <button class="delete-rule" aria-label="删除规则 ${o+1}">×</button>
    </div>`}).join(""),e.querySelectorAll("input,select").forEach(i=>i.addEventListener("change",()=>{const l=i.closest(".rule-data-row"),o=[...l.querySelectorAll("input,select")].map(p=>p.value.trim()),s=`${o[0]},${o[1]} -> ${o[2]},${o[3]},${o[4]}`;r("rules").value=pe(S("rules"),Number(l.dataset.index),s),L.saveDraft(E()),A()})),e.querySelectorAll(".delete-rule").forEach(i=>i.addEventListener("click",()=>{const l=i.closest(".rule-data-row");r("rules").value=pe(S("rules"),Number(l.dataset.index),null),L.saveDraft(E()),A()}))}function P(e){return e.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;")}function N(){r("status").textContent=G,r("currentState").textContent=g?.currentState??"—",r("readSymbol").textContent=g?.tape.read(g.headPosition)??"—",r("headPosition").textContent=String(g?.headPosition??0),r("stepCount").textContent=String(g?.stepCount??0);const t=S("tapeViewMode")==="fixed-zero"&&g&&Math.abs(g.headPosition)>8,n=g&&g.headPosition<-8?"←":"→";r("headState").textContent=g?t?`${n} 读写头在 ${g.headPosition} · ${g.currentState}`:`读写头 · ${g.currentState}`:"",r("stopMessage").textContent=q,we(),$t(),kt()}function kt(){if(r("gijswijtResult").hidden=B===null,B===null||!g)return;const e=pt(g.tape),t=r("gijswijtOutput"),n=e.join(", ");t.value!==n&&(t.value=n);const a=e.at(-1);r("gijswijtOutputStatus").textContent=g.currentState==="G.HALT"?`已停机：第 ${e.length} 项为 ${a}${a!==void 0&&a>B?`，严格大于阈值 ${B}`:""}。`:`已写入 ${e.length} 项${a===void 0?"；点击运行或单步写入首项。":`，最新项 ${a}；超过 ${B} 才停机。`}`}const K={accept:"接受",reject:"拒绝",halt:"已停机","missing-transition":"缺少转移规则"};function Ce(){const e=E();return Fe(!!g,ke,be(e))?A():!0}function ce(e=!0,t=!0){if(e&&!Ce()||!g)return!1;const n=r("unlimitedSteps").checked?null:Number(S("maxSteps"))||1e4;if(n!==null&&g.stepCount>=n)return G="达到步数限制",q=`已暂停在 ${n} 步`,T(!1),N(),!1;const a=g.step();return a.record&&(z.push(a.record),z.length>5e3&&z.shift()),a.stopped?(G=K[a.reason],q=a.reason==="missing-transition"?`状态 ${g.currentState} 读取 ${g.tape.read(g.headPosition)} 时无规则`:K[a.reason],T(!1)):G=U.running?"运行中":"已暂停",(t||a.stopped)&&N(),!a.stopped}const U=new at({getTargetSpeed:()=>Number(S("speed")),executeBatch:e=>{const t=g?.stepCount??0;let n=e,a=!0;for(;n-- >0&&a;)a=ce(!1,!1);return{executed:(g?.stepCount??t)-t,keepRunning:a}},onTick:e=>{r("actualSpeed").textContent=`实际 ${e.toFixed(e<10?1:0)} 步/秒`,N()}});function Ee(){U.running||Ce()&&(G="运行中",q="",U.start(),N())}function T(e=!0){U.stop(),e&&g&&G==="运行中"&&(G="已暂停"),N()}function Te(){if(T(!1),!g){A();return}g.reset(),z=[],X=0,M=null,G="就绪",q="",r("errors").textContent="",N()}const se={slider:r("speed"),number:r("speedNumber"),text:r("speedText")};function vt(){Se(se,Number(se.slider.value))}function Ge(e){const t=L.speedSave(()=>ht(L.storage,e));t&&(r("errors").textContent=t)}function Ae(e,t,n){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:n})),a.download=e,a.click(),URL.revokeObjectURL(a.href)}r("apply").addEventListener("click",A);r("compileGijswijt").addEventListener("click",()=>{try{const e=S("gijswijtThreshold").trim();if(!e)throw new Error("请输入整数阈值。");const t=ut(Number(e));if(!Q({...t,speed:Number(S("speed"))}))return;x=0,A();const n=Number(e)===3?" 此机器超过 3 需约 1514 万步，在 1000 步/秒下约 4.2 小时。":"";r("gijswijtCompileStatus").textContent=`转换完成，共 ${t.rules.split(`
`).length-3} 条规则。已开启 Max 步数；点击上方“运行”开始。${n}`}catch(e){r("gijswijtCompileStatus").textContent=e instanceof Error?e.message:"转换失败"}});r("rulePrev").addEventListener("click",()=>{x=Math.max(0,x-1),J()});r("ruleNext").addEventListener("click",()=>{x+=1,J()});r("step").addEventListener("click",()=>{T(!1),ce()});r("run").addEventListener("click",Ee);r("pause").addEventListener("click",()=>T());r("reset").addEventListener("click",Te);tt(se,Ge);r("tapeViewMode").addEventListener("change",()=>{X=0,M=null;const e=r("tape");e.style.transform="",e.style.transition="none",N()});Ve(r("tape"),{getScroll:()=>X,setScroll:e=>{S("tapeViewMode")==="free-drag"&&e!==X&&(X=e,we())},getPitch:xe,applyShift:e=>{r("tape").style.transform=e===0?"":`translateX(${e}px)`},isEnabled:()=>S("tapeViewMode")==="free-drag"});r("clear").addEventListener("click",()=>{L.protectDraftReplacement()&&(T(),r("rules").value="",L.saveDraft(E()))});r("addRule").addEventListener("click",()=>{const e=S("rules").trim();r("rules").value=`${e}${e?`
`:""}q0,□ -> HALT,□,N`,L.saveDraft(E()),J()});r("rules").addEventListener("input",()=>{x=0,J()});for(const e of["input","blankSymbol","initialState","acceptStates","rejectStates","haltStates","rules"])r(e).addEventListener("input",()=>L.saveDraft(E()));r("unlimitedSteps").addEventListener("change",()=>{r("maxSteps").disabled=r("unlimitedSteps").checked;const e=L.save(E());e&&(r("errors").textContent=e)});r("maxSteps").addEventListener("change",()=>{const e=L.save(E());e&&(r("errors").textContent=e)});r("example").addEventListener("change",()=>{r("exampleNote").textContent=D[S("example")].description});r("loadExample").addEventListener("click",()=>{const e=D[S("example")];Q(e)&&(A(),r("exampleNote").textContent=e.description)});r("exportProject").addEventListener("click",()=>L.compatibleExport());r("importProject").addEventListener("click",()=>r("fileInput").click());r("fileInput").addEventListener("change",async()=>{const e=r("fileInput"),t=e.files?.[0];e.value="",await L.importFile(t)});r("exportLog").addEventListener("click",()=>{const e="step,from,read,to,write,direction,headBefore,headAfter",t=z.map(n=>[n.step,n.fromState,n.readSymbol,n.toState,n.writeSymbol,n.direction,n.headBefore,n.headAfter].map(a=>JSON.stringify(a)).join(","));Ae("turing-machine-log.csv",[e,...t].join(`
`),"text/csv")});r("generatePuzzle").addEventListener("click",ye);r("generateRoute").addEventListener("click",St);r("cancelRoute").addEventListener("click",()=>{Re.cancel()});r("checkPuzzle").addEventListener("click",()=>{if(!k)return;const e=y.filter(Boolean).length;r("puzzleMessage").textContent=ge(k,y)?"完全正确！每一行都对应图灵机的一步计算。":`已放 ${e}/${y.length} 块；${e===y.length?"铺法不正确，请调整。":"继续把剩余瓷砖拼入棋盘。"}`});r("showSolution").addEventListener("click",()=>{k&&(C=!C,y=C?[...k.solution]:Array(k.solution.length).fill(null),O=null,r("showSolution").textContent=C?"返回自己拼":"查看正确拼法",r("puzzleMessage").textContent=C?"正确拼法已显示：从上到下是计算时间，从左到右是纸带位置。":"答案已收起，棋盘已清空。",Z())});r("tileTray").addEventListener("click",e=>{const t=e.target.closest("[data-select-tile]");!t||C||(O=t.dataset.selectTile,r("puzzleMessage").textContent="已选中瓷砖，请点击棋盘中的空格。",Z())});r("puzzleBoard").addEventListener("click",e=>{const t=e.target.closest("[data-slot]");if(!t||C)return;const n=Number(t.dataset.slot);O?Le(n,O):y[n]&&(y[n]=null,Z())});document.addEventListener("dragstart",e=>{const t=e.target.closest("[data-tile-id]");t&&e.dataTransfer&&e.dataTransfer.setData("text/plain",t.dataset.tileId)});r("puzzleBoard").addEventListener("dragover",e=>e.preventDefault());r("puzzleBoard").addEventListener("drop",e=>{e.preventDefault();const t=e.target.closest("[data-slot]"),n=e.dataTransfer?.getData("text/plain");t&&n&&Le(Number(t.dataset.slot),n)});document.addEventListener("keydown",e=>{e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLButtonElement||(e.code==="Space"&&(e.preventDefault(),U.running?T():Ee()),e.altKey&&e.code==="ArrowRight"&&(e.preventDefault(),T(!1),ce()),e.ctrlKey&&e.code==="KeyR"&&(e.preventDefault(),Te()))});L.mount({getProject:E,applyProject:e=>Q(e)?(A(),!0):!1,pause:T,download:Ae});L.start(e=>{Q({...e,...L.readDraft(),speed:ft(L.storage)??e.speed}),r("exampleNote").textContent=D.unary.description,A(),J()});
