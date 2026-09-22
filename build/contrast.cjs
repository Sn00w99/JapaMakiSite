const L=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const R=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
const bg='#000000', card='#121011';
const fg={washi:'#F4F1EA',ink2:'#A8A29C',ink3:'#78726C',hinomaru:'#D43932',hinoHot:'#E43030',hashi:'#E17342',hashiLit:'#F5844C',hashiBright:'#FFA76B'};
console.log('sobre #000        | sobre #121011  | AA texto(4.5) | AA grande(3.0)');
for(const[k,v]of Object.entries(fg)){
  const a=R(v,bg),b=R(v,card);
  console.log(`${k.padEnd(12)} ${v}  ${String(a).padStart(5)}  ${String(b).padStart(5)}   ${a>=4.5?'PASS':'fail'}        ${a>=3?'PASS':'fail'}`);
}
