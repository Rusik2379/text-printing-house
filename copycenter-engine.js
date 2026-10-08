/* Excel-compatible evaluator for the supplied TEKST calculators.
 * Source formulas remain data; no eval / Function / executable workbook content.
 */
(function(global){
const astCache=new Map();
function parse(src){
 if(astCache.has(src))return astCache.get(src);
 let p=0,t=[];src=src.replace(/^=/,'');
 while(p<src.length){
  let s=src.slice(p),m;
  if(/^\s/.test(s)){p++;continue;}
  if(s[0]==='"'){m=s.match(/^"((?:[^"]|"")*)"/);if(!m)throw Error('String');t.push({k:'v',v:m[1].replace(/""/g,'"')});}
  else if(s[0]==="'"){m=s.match(/^'((?:[^']|'')*)'/);if(!m)throw Error('Sheet');t.push({k:'id',v:m[1].replace(/''/g,"'")});}
  else if((m=s.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/)))t.push({k:'v',v:Number(m[0])});
  else if((m=s.match(/^[\p{L}_$][\p{L}\p{N}_.$]*/u)))t.push({k:'id',v:m[0]});
  else if((m=s.match(/^(<>|<=|>=|[+*/^&%=<>(),:!\-])/)))t.push({k:m[0],v:m[0]});
  else throw Error('Unsupported token '+s.slice(0,20));
  p+=m[0].length;
 }
 let i=0; const peek=()=>t[i]?.k, take=k=>{const x=t[i++];if(k&&x?.k!==k)throw Error('Expected '+k);return x;};
 function atom(){
  if(peek()==='-'||peek()==='+'){let op=take().k;return{t:'un',op,a:atom()};}
  if(peek()==='('){take();let a=expr();take(')');return a;}
  let x=take();if(!x)throw Error('Missing value');
  if(x.k==='v')return{t:'v',v:x.v};
  if(x.k!=='id')throw Error('Unexpected '+x.k);
  if(peek()==='('){take();let args=[];if(peek()!==')'){do{if(peek()===',')take();args.push(expr());}while(peek()===',');}take(')');return{t:'fn',name:x.v.toUpperCase(),args};}
  let sheet=null,ref=x.v;if(peek()==='!'){take();sheet=ref;ref=take('id').v;}
  if(peek()===':'){take();return{t:'range',sheet,from:ref,to:take('id').v};}
  if(!sheet&&/^(TRUE|FALSE)$/i.test(ref))return{t:'v',v:ref.toUpperCase()==='TRUE'};
  return{t:'ref',sheet,ref};
 }
 const precedence={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5};
 function expr(min=0){let a=atom();while(peek()==='%'){take();a={t:'un',op:'%',a};}while(precedence[peek()]>=min){let op=take().k,b=expr(precedence[op]+1);a={t:'op',op,a,b};}return a;}
 const a=expr();if(i!==t.length)throw Error('Extra tokens');astCache.set(src.startsWith('=')?src:'='+src,a);return a;
}
const flat=a=>Array.isArray(a)?a.flat(Infinity):[a];
const scalar=a=>Array.isArray(a)?a[0]?.[0]??a[0]:a;
const num=a=>{a=scalar(a);if(a===''||a==null)return 0;const n=Number(a);if(!Number.isFinite(n))throw Error('Not numeric');return n;};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'?a.toLocaleLowerCase()===b.toLocaleLowerCase():a===b;
function compare(a,b){if(typeof a==='string'&&typeof b==='string'){a=a.toLocaleLowerCase();b=b.toLocaleLowerCase();}if(a==null)a=typeof b==='string'?'':0;if(b==null)b=typeof a==='string'?'':0;return a<b?-1:a>b?1:0;}
const col=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
const coord=s=>{let m=s.replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/i);if(!m)throw Error('Bad cell '+s);return[m[1].toUpperCase().split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),+m[2]];};
class CalcEngine{
 constructor(book,inputs={}){this.book=book;this.inputs=inputs;this.memo=new Map();this.active=new Set();}
 get(sheet,ref){ref=ref.replace(/\$/g,'');const key=sheet+'!'+ref;if(Object.hasOwn(this.inputs,key))return this.inputs[key];if(this.memo.has(key))return this.memo.get(key);if(this.active.has(key))throw Error('Circular '+key);this.active.add(key);try{let v=this.book.sheets[sheet]?.cells[ref]?.v??null;let out=typeof v==='string'&&v.startsWith('=')?this.eval(parse(v),sheet):v;this.memo.set(key,out);return out;}finally{this.active.delete(key);}}
 formula(f,s){return this.eval(parse(f.startsWith('=')?f:'='+f),s);}
 range(s,a,b){let[x,y]=coord(a),[xx,yy]=coord(b),out=[];for(let r=y;r<=yy;r++){let row=[];for(let c=x;c<=xx;c++)row.push(this.get(s,col(c)+r));out.push(row);}return out;}
 eval(a,s){
  const e=x=>this.eval(x,s);
  if(a.t==='v')return a.v;
  if(a.t==='ref'){if(this.book.names[a.ref])return this.formula(this.book.names[a.ref],s);return this.get(a.sheet??s,a.ref);}
  if(a.t==='range')return this.range(a.sheet??s,a.from,a.to);
  if(a.t==='un'){let v=num(e(a.a));return a.op==='-'?-v:a.op==='%'?v/100:v;}
  if(a.t==='op'){let x=scalar(e(a.a)),y=scalar(e(a.b));switch(a.op){case '+':return num(x)+num(y);case '-':return num(x)-num(y);case '*':return num(x)*num(y);case '/':if(num(y)===0)throw Error('Division by zero');return num(x)/num(y);case '^':return num(x)**num(y);case '&':return String(x??'')+String(y??'');case '=':return same(x,y)||(x==null&&(y===0||y===''))||(y==null&&(x===0||x===''));case '<>':return !this.eval({...a,op:'='},s);case '<':return compare(x,y)<0;case '>':return compare(x,y)>0;case '<=':return compare(x,y)<=0;case '>=':return compare(x,y)>=0;}}
  let args=a.args;
  if(a.name==='IF')return e(args[e(args[0])?1:2]??{t:'v',v:false});
  if(a.name==='ISERROR'){try{e(args[0]);return false;}catch{return true;}}
  if(a.name==='AND')return args.every(x=>flat(e(x)).every(Boolean));
  if(a.name==='OR')return args.some(x=>flat(e(x)).some(Boolean));
  const v=args.map(e),ns=()=>v.flat(Infinity).filter(x=>typeof x==='number');
  switch(a.name){
   case 'NOT':return !v[0];case 'ISNUMBER':return typeof v[0]==='number'&&Number.isFinite(v[0]);
   case 'SUM':return ns().reduce((a,b)=>a+b,0);case 'COUNT':return ns().length;case 'MIN':return Math.min(...ns());case 'MAX':return Math.max(...ns());
   case 'INT':return Math.floor(num(v[0]));case 'MOD':return ((num(v[0])%num(v[1]))+num(v[1]))%num(v[1]);
   case 'ROUND':{const n=num(v[0]),f=10**num(v[1]);return Math.sign(n)*Math.round(Math.abs(n)*f+1e-9)/f;}
   case 'ROUNDUP':{const n=num(v[0]),f=10**num(v[1]);return Math.sign(n)*Math.ceil(Math.abs(n)*f-1e-10)/f;}
   case 'LOWER':return String(v[0]).toLowerCase();case 'SEARCH':{let p=String(v[1]).toLowerCase().indexOf(String(v[0]).toLowerCase(),num(v[2]??1)-1);if(p<0)throw Error('Not found');return p+1;}
   case 'MATCH':{const xs=flat(v[1]);let type=num(v[2]??1),idx=-1;for(let i=0;i<xs.length;i++){if(type===0&&same(xs[i],v[0]))return i+1;if(type===1&&compare(xs[i],v[0])<=0)idx=i;if(type===-1&&compare(xs[i],v[0])>=0)idx=i;}if(idx<0)throw Error('MATCH not found '+v[0]);return idx+1;}
   case 'INDEX':{let arr=v[0],r=num(v[1]),c=num(v[2]??1);if(!Array.isArray(arr))return arr;if(args.length===2&&arr.length===1){c=r;r=1;}if(r<1||c<1||r>arr.length||c>arr[0].length)throw Error('INDEX out of range');return arr[r-1][c-1];}
   case 'INDIRECT':return this.formula(String(v[0]),s);
   case 'SUMIF':case 'SUMIFS':{let sum,conditions=[];if(a.name==='SUMIF'){sum=flat(v[2]??v[0]);conditions=[[flat(v[0]),v[1]]];}else{sum=flat(v[0]);for(let i=1;i<v.length;i+=2)conditions.push([flat(v[i]),v[i+1]]);}const match=(x,k)=>{if(typeof k==='string'){const m=k.match(/^(<=|>=|<>|<|>|=)(.*)$/);if(m){let val=m[2];if(val!==''&&!isNaN(Number(val)))val=+val;const c=compare(x,val);return {'<':c<0,'>':c>0,'<=':c<=0,'>=':c>=0,'=':c===0,'<>':c!==0}[m[1]];}}return same(x,k);};return sum.reduce((acc,x,i)=>acc+(typeof x==='number'&&conditions.every(([r,k])=>match(r[i],k))?x:0),0);}
   default:throw Error('Unsupported function '+a.name);
  }
 }
}
global.TEXT_COPYCENTER_ENGINE=CalcEngine;
})(typeof globalThis!=='undefined'?globalThis:window);
