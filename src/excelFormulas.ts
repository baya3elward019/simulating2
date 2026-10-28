import type {Config} from './engine';
export type FormulaCell = {address:string; label:string; formula:string};
export function chanceFormulas(dice:boolean):FormulaCell[]{
  if(!dice)return [{address:'B4',label:'Random number / العدد العشوائي',formula:'RAND()'},{address:'B6',label:'Coin result / نتيجة العملة',formula:'IF(B4<0.5,"Heads / صورة","Tails / كتابة")'}];
  return [{address:'B4',label:'Die value / قيمة النرد',formula:'RANDBETWEEN(1,6)'},...[
    ['B7','IF(AND($B$4>=2,$B$4<=6),"●","")'],['C7','IF(AND($B$4>=1,$B$4<=6),"","")'],['D7','IF(AND($B$4>=4,$B$4<=6),"●","")'],
    ['B8','IF($B$4=6,"●","")'],['C8','IF(AND(MOD($B$4,2)=1,$B$4>=1,$B$4<=5),"●","")'],['D8','IF($B$4=6,"●","")'],
    ['B9','IF(AND($B$4>=4,$B$4<=6),"●","")'],['C9','IF(AND($B$4>=1,$B$4<=6),"","")'],['D9','IF(AND($B$4>=2,$B$4<=6),"●","")'],
  ].map(([address,formula])=>({address,label:'Pip cell / خلية نقطة',formula}))];
}
export function queueLayout(c:Config){const first=Math.max(c.lambda===undefined?c.iat.length:0,c.lambda===undefined?c.a.length:0,c.b?.length??0)+12;return {first,last:first+c.n-1,header:first-1};}
export const queueHeaders=['NC','RN IAT','IAT','AT','RN ST','Server (1=A, 2=B)','ST','SS','ES','T in Q','T in S','Idle T S','Previous ES A','Previous ES B','Updated ES A','Updated ES B','RN routing','Queue at arrival'];
export function queueFormulas(c:Config,row:number):FormulaCell[]{
  const {first,last}=queueLayout(c),two=!!c.b,m=c.lambda!==undefined;
  const lookup=(random:string,start:string,end:string,length:number)=>`VLOOKUP(${random},$${start}$6:$${end}$${5+length},2,TRUE)`;
  const iat=m?`IF($U$5>0,-LN(1-B${row})/$U$5,NA())`:`IF($D$${6+c.iat.length}="OK",${lookup(`B${row}`,'A','B',c.iat.length)},NA())`;
  const sa=`IF($I$${6+c.a.length}="OK",${lookup(`E${row}`,'F','G',c.a.length)},NA())`;
  const sb=two?`IF($N$${6+c.b!.length}="OK",${lookup(`E${row}`,'K','L',c.b!.length)},NA())`:'0';
  const fs=[`ROW()-${first-1}`,'RAND()',row===first&&!m?`IF($U$2=1,0,${iat})`:iat,row===first?`C${row}`:`D${row-1}+C${row}`,'RAND()',
    two?`IF($U$3="shared",IF(M${row}<=D${row},1,IF(N${row}<=D${row},2,IF(M${row}<=N${row},1,2))),IF($U$4="random",IF(Q${row}<0.5,1,2),IF($U$4="shortest",IF(M${row}<=N${row},1,2),IF(MOD(A${row},2)=1,1,2))))`:'1',
    m?`IF($U$6>0,-LN(1-E${row})/$U$6,NA())`:two?`IF(F${row}=1,${sa},${sb})`:sa,
    `MAX(D${row},IF(F${row}=1,M${row},N${row}))`,`H${row}+G${row}`,`H${row}-D${row}`,`I${row}-D${row}`,`MAX(0,H${row}-IF(F${row}=1,M${row},N${row}))`,
    row===first?'0':`O${row-1}`,row===first?'0':`P${row-1}`,`IF(F${row}=1,I${row},M${row})`,`IF(F${row}=2,I${row},N${row})`,two?'RAND()':'0',
    `COUNTIFS($D$${first}:$D$${last},"<="&D${row},$H$${first}:$H$${last},">"&D${row})`];
  return fs.map((formula,i)=>({address:`${String.fromCharCode(65+i)}${row}`,label:queueHeaders[i],formula}));
}
export function distributionFormulas(start:number,length:number):FormulaCell[]{const col=(i:number)=>String.fromCharCode(65+start+i);return Array.from({length},(_,i)=>{const r=i+6;return [{address:`${col(0)}${r}`,label:'CDM',formula:i?`${col(3)}${r-1}`:'0'},{address:`${col(3)}${r}`,label:'CDF',formula:`ROUND(${col(0)}${r}+${col(2)}${r},12)`}];}).flat();}
