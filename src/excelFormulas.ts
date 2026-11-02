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

// ---------------------------------------------------------------------------
// Birthday paradox workbook (one sheet). Addresses are fixed so the website guide matches the file.
export const BDAY = {N: 'B6', n: 'B7', target: 'B8', rooms: 'B9', stepHeader: 48, stepFirst: 49, stepRows: 100, expHeader: 48, expFirst: 49,
  hashHeader: 48, sessionHeader: 57, roomsHeader: 152, roomsFirst: 153, roomCount: 200, people: 100} as const;
export const bdayStepLast = BDAY.stepFirst + BDAY.stepRows - 1;
export const bdayRoomsLast = BDAY.roomsFirst + BDAY.roomCount - 1;
/** Column letter for 1-based index (1 → A, 27 → AA). */
export function colName(i: number): string {let s = ''; for (; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s;}
export const bdayMatchCol = colName(2 + BDAY.people); // after A (room) and the person columns
const lastPerson = colName(1 + BDAY.people);
export const bdayExact = (n: string, N: string) => `IF(${n}<2,0,IF(${n}>${N},1,1-EXP(GAMMALN(${N}+1)-GAMMALN(${N}-${n}+1)-${n}*LN(${N}))))`;
export function birthdaySummaryFormulas(): FormulaCell[] {
  const {stepFirst} = BDAY, steps = `D${stepFirst}:D${bdayStepLast}`;
  return [
    {address: 'E6', label: 'Pairs n(n−1)/2 / عدد الأزواج', formula: 'B7*(B7-1)/2'},
    {address: 'E7', label: 'Exact p(n) / الاحتمال الدقيق', formula: bdayExact('B7', 'B6')},
    {address: 'E8', label: 'Approximation 1−e^(−n(n−1)/2N) / التقريب الأسي', formula: 'IF(B7<2,0,1-EXP(-B7*(B7-1)/(2*B6)))'},
    {address: 'E9', label: 'n for the target ≈ √(2N·ln(1/(1−p))) / العدد اللازم', formula: 'SQRT(2*B6*LN(1/(1-B8)))'},
    {address: 'E10', label: 'Smallest n with exact p ≥ target / أصغر عدد', formula: `IF(COUNTIF(${steps},"<"&B8)>=${BDAY.stepRows},">${BDAY.stepRows}",COUNTIF(${steps},"<"&B8)+1)`},
    {address: 'E11', label: 'Live rooms with a match (F9) / نسبة الغرف المتطابقة', formula: `AVERAGE(${bdayMatchCol}${BDAY.roomsFirst}:${bdayMatchCol}${bdayRoomsLast})`},
    {address: 'E12', label: '95% sampling margin 1.96·√(p(1−p)/R) / هامش الخطأ', formula: 'IF(B9>0,1.96*SQRT(E7*(1-E7)/B9),0)'},
  ];
}
export function birthdayStepFormulas(row: number): FormulaCell[] {
  return [
    {address: `B${row}`, label: '(N−k+1)/N — chance person k avoids the taken days', formula: `MAX(0,($B$6-A${row}+1)/$B$6)`},
    {address: `C${row}`, label: 'Q(k) all different = Q(k−1)·(N−k+1)/N', formula: row === BDAY.stepFirst ? `B${row}` : `C${row - 1}*B${row}`},
    {address: `D${row}`, label: 'Exact p(k) = 1 − Q(k)', formula: `1-C${row}`},
    {address: `E${row}`, label: 'Approx 1 − e^(−k(k−1)/(2N))', formula: `1-EXP(-A${row}*(A${row}-1)/(2*$B$6))`},
    {address: `F${row}`, label: 'Approx − exact', formula: `E${row}-D${row}`},
  ];
}
export function birthdayExperimentFormulas(row: number): FormulaCell[] {
  const table = `$A$${BDAY.stepFirst}:$E$${bdayStepLast}`;
  return [
    {address: `K${row}`, label: 'Exact p(n) looked up in the step table', formula: `VLOOKUP(H${row},${table},4,FALSE)`},
    {address: `L${row}`, label: 'Approximation looked up in the step table', formula: `VLOOKUP(H${row},${table},5,FALSE)`},
    {address: `M${row}`, label: 'Simulated − exact', formula: `J${row}-K${row}`},
    {address: `N${row}`, label: '95% margin 1.96·√(p(1−p)/T)', formula: `1.96*SQRT(K${row}*(1-K${row})/I${row})`},
    {address: `O${row}`, label: 'Inside the 95% margin?', formula: `IF(ABS(M${row})<=N${row},"within / ضمن الهامش","outside / خارج الهامش")`},
  ];
}
export function birthdayRoomFormulas(row: number): FormulaCell[] {
  const people = `B${row}:${lastPerson}${row}`;
  return [
    {address: `B${row}`, label: 'Random birthday of person 1 (blank if beyond n)', formula: `IF(B$${BDAY.roomsHeader}<=$B$7,RANDBETWEEN(1,$B$6),"")`},
    {address: `${bdayMatchCol}${row}`, label: 'Room has a shared birthday? 1 = yes', formula: `IF(SUMPRODUCT((${people}<>"")*(COUNTIF(${people},${people})>1))>0,1,0)`},
  ];
}
export function birthdayFormulas(): FormulaCell[] {
  return [...birthdaySummaryFormulas(), ...birthdayStepFormulas(BDAY.stepFirst + 1), ...birthdayExperimentFormulas(BDAY.expFirst), ...birthdayRoomFormulas(BDAY.roomsFirst)];
}
