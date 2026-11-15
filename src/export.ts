import ExcelJS from 'exceljs';
import {stats,mm1,type Config,type Dist,type Row} from './engine';
import {chanceFormulas,distributionFormulas,queueFormulas,queueHeaders,queueLayout,BDAY,bdayStepLast,bdayRoomsLast,bdayMatchCol,colName,birthdayFormulas,birthdaySummaryFormulas,birthdayStepFormulas,birthdayExperimentFormulas,birthdayRoomFormulas,bdayExact,type FormulaCell} from './excelFormulas';
import {LAWS,type LawTopic} from './laws';
import {sweep,DAYS,HALF_FACTOR,type SweepRow} from './birthday';

function workbook(){const w=new ExcelJS.Workbook();w.creator='SimuLab';w.calcProperties.fullCalcOnLoad=true;return w;}
function title(s:ExcelJS.Worksheet,text:string,end='R'){s.mergeCells(`A1:${end}1`);s.getCell('A1').value=text;s.getCell('A1').font={bold:true,size:20,color:{argb:'FFFFFFFF'}};s.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF18346A'}};s.getRow(1).height=38;}
function header(s:ExcelJS.Worksheet,row:number,start:number,labels:string[]){labels.forEach((v,i)=>{const cell=s.getCell(row,start+i);cell.value=v;cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF3158A0'}};cell.alignment={wrapText:true,vertical:'middle'};});s.getRow(row).height=32;}
function formula(s:ExcelJS.Worksheet,address:string,f:string,result?:number|string){s.getCell(address).value={formula:f,...(result===undefined?{}:{result})};s.getCell(address).numFmt='0.000';}
function input(s:ExcelJS.Worksheet,address:string,value:number|string){const cell=s.getCell(address);cell.value=value;cell.font={color:{argb:'FF245AC3'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF1FF'}};}
type Spans=[[number,number],[number,number],[number,number],[number,number]];
/** Writes the "Laws / القوانين" table: law name, mathematics, Excel formula and meaning (Arabic + English). Returns the next free row. */
export function lawsBlock(s:ExcelJS.Worksheet,row:number,topic:LawTopic,spans:Spans){const labels=['Law / القانون','Mathematics / الصيغة الرياضية','Excel / صيغة إكسل','Meaning / الشرح'];
  const put=(r:number,i:number,v:string)=>{const [a,b]=spans[i];if(b>a)s.mergeCells(r,a,r,b);const cell=s.getCell(r,a);cell.value=v;cell.alignment={wrapText:true,vertical:'middle'};return cell;};
  s.mergeCells(row,spans[0][0],row,spans[3][1]);const t=s.getCell(row,spans[0][0]);t.value='Laws and formulas behind this simulation / القوانين والمعادلات وراء هذه المحاكاة';t.font={bold:true,size:13,color:{argb:'FF18346A'}};
  labels.forEach((l,i)=>{const c=put(row+1,i,l);c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF3158A0'}};});
  LAWS[topic].forEach((law,j)=>{const r=row+2+j;put(r,0,`${law.name[0]}\n${law.name[1]}`).font={bold:true};const m=put(r,1,law.math);m.font={name:'Cambria Math',size:11};m.alignment={wrapText:true,vertical:'middle',readingOrder:'ltr'};const x=put(r,2,law.excel??'—');x.font={name:'Consolas',size:10};x.alignment={wrapText:true,vertical:'middle',readingOrder:'ltr'};put(r,3,`${law.meaning[1]}\n${law.meaning[0]}`);s.getRow(r).height=Math.max(48,Math.ceil(Math.max(law.meaning[0].length,law.math.length)/45)*15+18);if(j%2)for(let i=0;i<4;i++)s.getCell(r,spans[i][0]).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6FC'}};});
  return row+2+LAWS[topic].length;}
function distribution(s:ExcelJS.Worksheet,d:Dist,start:number,label:string){const col=(i:number)=>String.fromCharCode(64+start+i);s.getCell(4,start).value=label;header(s,5,start,['CDM','Time','P','CDF']);let total=0;d.forEach((x,i)=>{const r=i+6;input(s,`${col(1)}${r}`,x.value);input(s,`${col(2)}${r}`,x.p);formula(s,`${col(0)}${r}`,i?`${col(3)}${r-1}`:'0',total);total+=x.p;formula(s,`${col(3)}${r}`,`ROUND(${col(0)}${r}+${col(2)}${r},12)`,total);s.getCell(`${col(1)}${r}`).dataValidation={type:'decimal',operator:'greaterThanOrEqual',formulae:[0],showErrorMessage:true,error:'Time must be nonnegative.'};s.getCell(`${col(2)}${r}`).dataValidation={type:'decimal',operator:'between',formulae:[0,1],showErrorMessage:true,error:'Probability must be between 0 and 1.'};});const r=6+d.length,last=r-1;s.getCell(r,start).value='Σ P / validation';formula(s,`${col(2)}${r}`,`SUM(${col(2)}6:${col(2)}${last})`,1);formula(s,`${col(3)}${r}`,`IF(AND(COUNT(${col(1)}6:${col(1)}${last})=${d.length},COUNT(${col(2)}6:${col(2)}${last})=${d.length},MIN(${col(1)}6:${col(1)}${last})>=0,MIN(${col(2)}6:${col(2)}${last})>=0,MAX(${col(2)}6:${col(2)}${last})<=1,ABS(${col(2)}${r}-1)<0.00000001),"OK","INVALID")`,'OK');}

export async function makeWorkbook(rows:Row[],c:Config){
  const w=workbook(),s=w.addWorksheet('Simulation'),{first,last,header:head}=queueLayout(c),two=!!c.b,m=c.lambda!==undefined,stat=stats(rows,two?2:1);
  title(s,`SimuLab · ${m?'M/M/1':two?'Two servers':'Single queue'} · محاكاة إكسل`);
  s.mergeCells('A2:R2');s.getCell('A2').value='F9 / Fn+F9: new simulation • RAND → VLOOKUP → all calculations update • اضغط F9 لمحاكاة جديدة';s.getRow(2).height=26;
  s.mergeCells('A3:R3');s.getCell('A3').value='Blue cells are editable inputs. CDM is the lower bound. A wins shared-queue ties. First arrival: 1=zero, 0=sampled. / المدخلات باللون الأزرق';
  if(!m){distribution(s,c.iat,1,'Interarrival / زمن الوصول');distribution(s,c.a,6,'Service A / خدمة أحمد');if(c.b)distribution(s,c.b,11,'Service B / خدمة بكر');}
  header(s,1,20,['Controls / الإعدادات','Value / القيمة']);
  const controls:[string,string|number][]=[['First arrival at 0',m?0:Number(c.zero)],['Queue mode',c.mode??'shared'],['Routing',c.routing??'alternate'],['λ',c.lambda??2],['μ',c.mu??3]];
  controls.forEach(([label,v],i)=>{s.getCell(`T${i+2}`).value=label;input(s,`U${i+2}`,v);});
  s.getCell('U2').dataValidation={type:'whole',operator:'between',formulae:[0,1],showErrorMessage:true};s.getCell('U3').dataValidation={type:'list',formulae:['"shared,independent"'],showErrorMessage:true};s.getCell('U4').dataValidation={type:'list',formulae:['"alternate,random,shortest"'],showErrorMessage:true};
  for(const address of ['U5','U6'])s.getCell(address).dataValidation={type:'decimal',operator:'greaterThan',formulae:[0],showErrorMessage:true};
  s.getCell('T7').value='Customers / العملاء';s.getCell('U7').value=c.n;
  s.getCell('T8').value='F9 recalculates every sample. Seed applies only to browser runs.';s.getCell('T8').alignment={wrapText:true};s.getRow(8).height=44;
  header(s,head,1,queueHeaders);const free=[0,0];
  rows.forEach((r,i)=>{const rr=first+i;const cached=[r.NC,r.ri,r.IAT,r.AT,r.rs,r.server+1,r.ST,r.SS,r.ES,r.wait,r.system,r.idle,free[0],free[1],r.server===0?r.ES:free[0],r.server===1?r.ES:free[1],two?(r.server===0?.25:.75):0,rows.filter(x=>x.AT<=r.AT&&x.SS>r.AT).length];queueFormulas(c,rr).forEach((cell,j)=>formula(s,cell.address,cell.formula,cached[j]));free[r.server]=r.ES;});
  const range=(col:string)=>`${col}${first}:${col}${last}`;
  header(s,10,20,['Statistics / الإحصاءات','Live value']);
  const measures:[string,string,number][]=[
    ['Total wait',`SUM(${range('J')})`,stat.totalWait],['Average wait',`AVERAGE(${range('J')})`,stat.avgWait],['Probability of wait',`COUNTIF(${range('J')},">0")/COUNT(${range('A')})`,stat.waitProbability],['Horizon',`MAX(${range('I')})`,stat.totalTime],['Total idle',`U14*${two?2:1}-SUM(${range('G')})`,stat.totalIdle],['Professor effectiveness / idle ratio',`IF(U14=0,0,U15/(U14*${two?2:1}))`,stat.idleRatio],['Actual utilization','IF(U14=0,0,1-U16)',stat.utilization],['Average system time',`AVERAGE(${range('K')})`,stat.avgSystem],['Maximum queue',`MAX(${range('R')})`,stat.maxQueue],['L (simulation)',`IF(U14=0,0,SUM(${range('K')})/U14)`,stat.L],['Lq (simulation)',`IF(U14=0,0,SUM(${range('J')})/U14)`,stat.Lq],
  ];measures.forEach(([name,f,v],i)=>{s.getCell(`T${11+i}`).value=name;formula(s,`U${11+i}`,f,v);});
  for(let server=1;server<=(two?2:1);server++){const base=23+(server-1)*3;s.getCell(`T${base}`).value=`Server ${server} busy`;formula(s,`U${base}`,`SUMIF(${range('F')},${server},${range('G')})`,stat.perServer[server-1].busy);s.getCell(`T${base+1}`).value=`Server ${server} idle`;formula(s,`U${base+1}`,`U14-U${base}`,stat.perServer[server-1].idle);s.getCell(`T${base+2}`).value=`Server ${server} utilization`;formula(s,`U${base+2}`,`IF(U14=0,0,U${base}/U14)`,stat.perServer[server-1].utilization);}
  if(m){header(s,30,20,['M/M/1 theory','Value']);const theory=mm1(c.lambda!,c.mu!);const fs=['$U$5/$U$6','$U$5/($U$6-$U$5)','$U$5^2/($U$6*($U$6-$U$5))','1/($U$6-$U$5)','$U$5/($U$6*($U$6-$U$5))'];['rho','L','Lq','W','Wq'].forEach((name,i)=>{s.getCell(`T${31+i}`).value=name;formula(s,`U${31+i}`,`IF(AND($U$5>0,$U$6>$U$5),${fs[i]},"No finite steady state")`,theory?Object.values(theory)[i]:'No finite steady state');});}
  const help=Math.max(last+4,39);header(s,help,1,['Cell / الخلية','Meaning / المعنى']);s.mergeCells(`C${help}:R${help}`);s.getCell(`C${help}`).value='Exact Excel formula / صيغة إكسل الفعلية';
  const guide=[...(!m?[...distributionFormulas(0,c.iat.length),...distributionFormulas(5,c.a.length),...(c.b?distributionFormulas(10,c.b.length):[])]:[]),...queueFormulas(c,first),...(c.n>1?queueFormulas(c,first+1):[])];guide.forEach((cell,i)=>{const rr=help+i+1;s.getCell(`A${rr}`).value=cell.address;s.getCell(`B${rr}`).value=cell.label;s.mergeCells(`C${rr}:R${rr}`);s.getCell(`C${rr}`).value=`=${cell.formula}`;s.getCell(`C${rr}`).font={name:'Consolas',size:10};s.getCell(`B${rr}`).alignment={wrapText:true};s.getRow(rr).height=30;});
  lawsBlock(s,help+guide.length+3,m?'mm1':two?'two':'queue',[[1,3],[4,9],[10,13],[14,18]]);
  for(const col of ['A','F','R'])for(let r=first;r<=last;r++)s.getCell(`${col}${r}`).numFmt='0';for(const col of ['B','E','Q'])for(let r=first;r<=last;r++)s.getCell(`${col}${r}`).numFmt='0.0000';
  s.columns.forEach((col,i)=>{col.width=i===19?37:i===20?24:16;});s.getColumn('S').width=3;s.getRow(3).height=30;s.getCell('A3').alignment={wrapText:true};s.views=[{state:'frozen',ySplit:head,xSplit:1}];s.autoFilter=`A${head}:R${last}`;
  s.addConditionalFormatting({ref:`J${first}:J${last}`,rules:[{type:'cellIs',operator:'greaterThan',formulae:['0'],priority:1,style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFE6B3'}}}}]});
  s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};return w;
}

export function makeChanceWorkbook(dice:boolean){const w=workbook(),s=w.addWorksheet(dice?'Dice':'Coin');title(s,dice?'SimuLab · Dice / النرد':'SimuLab · Coin / العملة','J');s.mergeCells('A2:J2');s.getCell('A2').value='F9 / Fn+F9 → recalculate / اضغط لإعادة المحاكاة. No macros / بدون ماكرو.';s.getRow(2).height=28;s.getCell('A4').value=dice?'Die value / القيمة':'RAND / العدد العشوائي';
  for(const cell of chanceFormulas(dice))formula(s,cell.address,cell.formula);
  if(dice){for(let r=7;r<=9;r++){s.getRow(r).height=49;for(let c=2;c<=4;c++){const cell=s.getCell(r,c);cell.font={name:'Arial',size:30,color:{argb:'FF193666'}};cell.alignment={horizontal:'center',vertical:'middle'};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF1FF'}};}}}else{s.getCell('A6').value='Result / النتيجة';s.mergeCells('B6:D8');s.getCell('B6').font={size:24,bold:true,color:{argb:'FF3158A0'}};s.getCell('B6').alignment={horizontal:'center',vertical:'middle'};}
  header(s,12,1,['Cell / الخلية','Purpose / الوظيفة']);s.mergeCells('B12:C12');s.mergeCells('D12:J12');header(s,12,4,['Formula / الصيغة']);
  chanceFormulas(dice).forEach((c,i)=>{const r=i+13;s.getCell(`A${r}`).value=c.address;s.mergeCells(`B${r}:C${r}`);s.getCell(`B${r}`).value=c.label;s.getCell(`B${r}`).alignment={wrapText:true,vertical:'middle'};s.mergeCells(`D${r}:J${r}`);s.getCell(`D${r}`).value=`=${c.formula}`;s.getCell(`D${r}`).font={name:'Consolas',size:10};s.getCell(`D${r}`).alignment={wrapText:true,vertical:'middle',readingOrder:'ltr'};s.getRow(r).height=38;});
  lawsBlock(s,13+chanceFormulas(dice).length+2,dice?'dice':'coin',[[1,1],[2,4],[5,6],[7,10]]);
  s.columns.forEach((c,i)=>c.width=i===0?24:12);s.getColumn('B').width=12;s.getCell('B4').numFmt=dice?'0':'0.000000';s.views=[{showGridLines:false}];s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};return w;
}
export async function save(w:ExcelJS.Workbook,name:string){const buffer=await w.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([buffer as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`simulab-${name}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportChance(_values:{random:number;value:number}[],dice:boolean){await save(makeChanceWorkbook(dice),dice?'dice':'coin');}



// ---------------------------------------------------------------------------
// Birthday paradox workbook: one live sheet with inputs, laws, the exact/approximate step table,
// the website's Monte Carlo experiment, hash/session tables and 200 live rooms (F9 = new rooms).
export type BirthdayExport={n:number;N?:number;experiment?:SweepRow[];experimentN?:number;seed?:string;sessionBits?:number;activeSessions?:number};
const fill=(argb:string)=>({type:'pattern' as const,pattern:'solid' as const,fgColor:{argb}});
function bdayFormula(s:ExcelJS.Worksheet,address:string,f:string,result:number|string,fmt='0.0000'){s.getCell(address).value={formula:f,result};s.getCell(address).numFmt=fmt;}
export function makeBirthdayWorkbook(o:BirthdayExport){
  const w=workbook(),s=w.addWorksheet('Birthday Paradox'),N=DAYS,n=Math.min(BDAY.people,Math.max(2,Math.round(o.n)));
  const exp=o.experiment?.length?o.experiment:sweep({trials:10000,N});const expN=o.experiment?.length?(o.experimentN??N):N;
  title(s,'SimuLab · Birthday Paradox / مفارقة عيد الميلاد','O');
  s.mergeCells('A2:O2');s.getCell('A2').value='F9 / Fn+F9: 200 new random rooms • Blue cells are inputs • اضغط F9 لتوليد 200 غرفة جديدة، والخلايا الزرقاء مدخلات قابلة للتعديل';s.getRow(2).height=26;
  s.mergeCells('A3:O3');s.getCell('A3').value='Assumption: N equally likely values (365 days, no 29 February). All probabilities are rounded to four decimals. / الافتراض: N قيمة متساوية الاحتمال (365 يوماً بدون 29 فبراير)، والنتائج مقربة إلى أربع خانات عشرية.';s.getCell('A3').alignment={wrapText:true};s.getRow(3).height=30;
  // Inputs and key results
  header(s,5,1,['Inputs / المدخلات','Value / القيمة']);header(s,5,4,['Key results / النتائج','Live value / القيمة']);
  const inputs:[string,number][]=[['N — equally likely values (days) / عدد القيم',N],['n — people in a room (2–100) / عدد الأشخاص',n],['Target probability / الاحتمال المستهدف',0.5],['Live rooms below (fixed) / عدد الغرف',BDAY.roomCount]];
  inputs.forEach(([label,v],i)=>{s.getCell(`A${6+i}`).value=label;if(i<3)input(s,`B${6+i}`,v);else s.getCell(`B${6+i}`).value=v;});
  s.getCell('B6').dataValidation={type:'whole',operator:'between',formulae:[2,1000000],showErrorMessage:true,error:'N must be a whole number ≥ 2.'};
  s.getCell('B7').dataValidation={type:'whole',operator:'between',formulae:[2,BDAY.people],showErrorMessage:true,error:`n must be between 2 and ${BDAY.people}.`};
  s.getCell('B8').dataValidation={type:'decimal',operator:'between',formulae:[0.0001,0.9999],showErrorMessage:true};
  const exactN=(k:number)=>{let q=1;for(let j=1;j<k;j++)q*=(N-j)/N;return k<2?0:1-q;};
  const cached=[n*(n-1)/2,exactN(n),1-Math.exp(-n*(n-1)/(2*N)),Math.sqrt(2*N*Math.LN2),23,exactN(n),1.96*Math.sqrt(exactN(n)*(1-exactN(n))/BDAY.roomCount)];
  birthdaySummaryFormulas().forEach((c,i)=>{s.getCell(`D${6+i}`).value=c.label;bdayFormula(s,c.address,c.formula,cached[i],i===0||i===4?'0':i===3?'0.0000':'0.0000');});
  // Laws
  const afterLaws=lawsBlock(s,14,'birthday',[[1,1],[2,4],[5,8],[9,15]]);
  // Formula guide
  const guideRow=afterLaws+1;header(s,guideRow,1,['Cell / الخلية','Meaning / المعنى']);s.mergeCells(guideRow,3,guideRow,15);header(s,guideRow,3,['Exact Excel formula / صيغة إكسل الفعلية']);
  const guide:FormulaCell[]=birthdayFormulas();
  if(guideRow+guide.length>=BDAY.stepHeader-1)throw Error('Birthday layout overlap');
  guide.forEach((c,i)=>{const r=guideRow+1+i;s.getCell(`A${r}`).value=c.address;s.getCell(`B${r}`).value=c.label;s.getCell(`B${r}`).alignment={wrapText:true};s.mergeCells(r,3,r,15);s.getCell(`C${r}`).value=`=${c.formula}`;s.getCell(`C${r}`).font={name:'Consolas',size:9};});
  // Step table k = 1..100
  const h=BDAY.stepHeader;s.getCell(`A${h-1}`).value='Theory table: exact product vs exponential approximation / جدول النظرية: الصيغة الدقيقة مقابل التقريب';s.getCell(`A${h-1}`).font={bold:true,size:12};
  header(s,h,1,['k (people)','(N−k+1)/N','Q(k) all different','p(k) exact','p(k) approx','approx − exact']);
  let q=1;for(let k=1;k<=BDAY.stepRows;k++){const r=BDAY.stepFirst+k-1;s.getCell(`A${r}`).value=k;const factor=Math.max(0,(N-k+1)/N);q*=factor;const ap=1-Math.exp(-k*(k-1)/(2*N));const vals=[factor,q,1-q,ap,ap-(1-q)];birthdayStepFormulas(r).forEach((c,i)=>bdayFormula(s,c.address,c.formula,vals[i]));if([10,23,50].includes(k))for(let c=1;c<=6;c++)s.getCell(r,c).fill=fill('FFFFE6B3');}
  // Experiment (values from the website) with live comparisons
  s.getCell(`H${h-1}`).value=`Simulation experiment from the website (N = ${expN}${o.seed?`, seed "${o.seed}"`:''}) / تجربة المحاكاة من المنصة`;s.getCell(`H${h-1}`).font={bold:true,size:12};
  header(s,h,8,['n','Trials T','Simulated p̂','Exact p(n)','Approx p(n)','p̂ − exact','95% margin','Within margin?']);
  exp.forEach((row,i)=>{const r=BDAY.expFirst+i;s.getCell(`H${r}`).value=row.n;s.getCell(`I${r}`).value=row.trials;s.getCell(`I${r}`).numFmt='#,##0';s.getCell(`J${r}`).value=row.simulated;s.getCell(`J${r}`).numFmt='0.0000';s.getCell(`J${r}`).fill=fill('FFEFF7EE');const vals:(number|string)[]=[row.exact,row.approx,row.diff,row.margin,Math.abs(row.diff)<=row.margin?'within / ضمن الهامش':'outside / خارج الهامش'];birthdayExperimentFormulas(r).forEach((c,j)=>bdayFormula(s,c.address,c.formula,vals[j]));});
  const expLast=BDAY.expFirst+exp.length-1,sumRow=expLast+1;s.getCell(`H${sumRow}`).value='Mean |p̂ − exact|';bdayFormula(s,`M${sumRow}`,`SUMPRODUCT(ABS(M${BDAY.expFirst}:M${expLast}))/COUNT(M${BDAY.expFirst}:M${expLast})`,exp.reduce((a,r)=>a+Math.abs(r.diff),0)/exp.length);s.getCell(`H${sumRow}`).font={bold:true};
  s.mergeCells(sumRow+1,8,sumRow+3,15);s.getCell(`H${sumRow+1}`).value='Chart: select H:K of this table → Insert → Line chart (simulated vs exact). / للرسم البياني: حدد الأعمدة H إلى K ثم إدراج ← مخطط خطي. The green values come from the website run; exact and approximate values are live formulas.';s.getCell(`H${sumRow+1}`).alignment={wrapText:true,vertical:'top'};
  if(expN!==N){s.getCell(`H${sumRow+4}`).value=`Note: the website experiment used N = ${expN}; the exact column uses N in B6.`;}
  // Hash table and session IDs (columns Q:W)
  const H=BDAY.hashHeader;s.getCell(`Q${H-1}`).value='Hash functions: birthday bound / دوال التجزئة وحد عيد الميلاد';s.getCell(`Q${H-1}`).font={bold:true,size:12};
  header(s,H,17,['Space / الفضاء','bits b','N = 2^b','n for 50% ≈ 1.1774·√N','log2(n50)','Preimage ≈ 2^b','Security bits b/2']);
  const hashes:[string,number|null][]=[['Birthdays (N = 365)',null],['Session IDs 16-bit',16],['MD5',128],['SHA-1',160],['SHA-256',256]];
  hashes.forEach(([name,b],i)=>{const r=H+1+i,NN=b===null?365:2**b;s.getCell(`Q${r}`).value=name;if(b===null){bdayFormula(s,`R${r}`,`LOG(S${r},2)`,Math.log2(365));s.getCell(`S${r}`).value=365;}else{s.getCell(`R${r}`).value=b;bdayFormula(s,`S${r}`,`2^R${r}`,NN,b>40?'0.0000E+00':'#,##0');}
    const n50=Math.sqrt(2*NN*Math.LN2);bdayFormula(s,`T${r}`,`SQRT(2*S${r}*LN(2))`,n50,NN>1e9?'0.0000E+00':'0.0000');bdayFormula(s,`U${r}`,`LOG(T${r},2)`,Math.log2(n50));bdayFormula(s,`V${r}`,`S${r}`,NN,NN>1e9?'0.0000E+00':'#,##0');bdayFormula(s,`W${r}`,`R${r}/2`,Math.log2(NN)/2,'0.00');});
  const S=BDAY.sessionHeader;header(s,S,17,['Session IDs / معرّفات الجلسات','Value / القيمة']);const bits=o.sessionBits??16,NN=2**bits,n50=Math.sqrt(2*NN*Math.LN2),nUp=Math.ceil(n50),active=o.activeSessions??nUp;
  let qs=0;for(let k=1;k<nUp;k++)qs+=Math.log1p(-k/NN);
  const session:[string,string|null,number|string,string][]=[
    ['ID length in bits / طول المعرّف',null,bits,'0'],['N = 2^bits',`2^R${S+1}`,NN,'#,##0'],['√N',`SQRT(R${S+2})`,Math.sqrt(NN),'0.0000'],['n for 50% ≈ 1.1774·√N',`SQRT(2*R${S+2}*LN(2))`,n50,'0.0000'],['Rounded up / بالتقريب لأعلى',`ROUNDUP(R${S+4},0)`,nUp,'0'],
    ['Exact P(collision) at that n',`IF(R${S+2}>1E9,1-EXP(-R${S+5}*(R${S+5}-1)/(2*R${S+2})),${bdayExact(`R${S+5}`,`R${S+2}`)})`,1-Math.exp(qs),'0.0000'],
    ['Active sessions now / الجلسات النشطة',null,active,'#,##0'],['P(one random guess hits a live session) = active/N',`R${S+7}/R${S+2}`,active/NN,'0.0000'],['Expected guesses to hijack one session = N/active',`R${S+2}/R${S+7}`,NN/active,'#,##0.00'],
    ['OWASP: use ≥128-bit IDs (≥64 bits entropy) from a CSPRNG',null,128,'0'],['n for 50% with 128-bit IDs',`SQRT(2*2^R${S+10}*LN(2))`,Math.sqrt(2*2**128*Math.LN2),'0.0000E+00']];
  session.forEach(([label,f,v,fmt],i)=>{const r=S+1+i;s.getCell(`Q${r}`).value=label;s.getCell(`Q${r}`).alignment={wrapText:true};if(f)bdayFormula(s,`R${r}`,f,v,fmt);else{input(s,`R${r}`,v);s.getCell(`R${r}`).numFmt=fmt;}});
  // Live rooms
  const RH=BDAY.roomsHeader;s.getCell(`A${RH-1}`).value=`Live simulation: ${BDAY.roomCount} rooms, each person gets RANDBETWEEN(1,N); orange = shared birthday. Only the first n persons (B7) are filled. / محاكاة حية: كل صف غرفة`;s.getCell(`A${RH-1}`).font={bold:true,size:12};
  header(s,RH,1,['Room / الغرفة']);for(let p=1;p<=BDAY.people;p++){const c=s.getCell(RH,1+p);c.value=p;c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill=fill('FF3158A0');c.alignment={horizontal:'center'};}
  header(s,RH,2+BDAY.people,['Match? 1 = yes']);
  const peopleEnd=colName(1+BDAY.people);
  for(let i=0;i<BDAY.roomCount;i++){const r=BDAY.roomsFirst+i;s.getCell(`A${r}`).value=i+1;const [person,match]=birthdayRoomFormulas(r);for(let p=1;p<=BDAY.people;p++){const col=colName(1+p);s.getCell(`${col}${r}`).value={formula:person.formula.replace(/^IF\(B\$/,`IF(${col}$`)};}s.getCell(match.address).value={formula:match.formula};}
  s.addConditionalFormatting({ref:`B${BDAY.roomsFirst}:${peopleEnd}${bdayRoomsLast}`,rules:[{type:'expression',priority:1,formulae:[`AND(B${BDAY.roomsFirst}<>"",COUNTIF($B${BDAY.roomsFirst}:$${peopleEnd}${BDAY.roomsFirst},B${BDAY.roomsFirst})>1)`],style:{fill:fill('FFFFB38A'),font:{bold:true}}}]});
  s.addConditionalFormatting({ref:`${bdayMatchCol}${BDAY.roomsFirst}:${bdayMatchCol}${bdayRoomsLast}`,rules:[{type:'cellIs',operator:'equal',formulae:['1'],priority:2,style:{fill:fill('FFFFE6B3')}}]});
  // Layout
  s.getColumn(1).width=34;for(let c=2;c<=2+BDAY.people;c++)s.getColumn(c).width=6;for(const c of [2,3,4,5,6])s.getColumn(c).width=16;s.getColumn(4).width=30;s.getColumn(7).width=3;for(let c=8;c<=15;c++)s.getColumn(c).width=15;s.getColumn(17).width=34;for(let c=18;c<=23;c++)s.getColumn(c).width=18;s.getColumn(bdayMatchCol).width=14;
  s.views=[{state:'frozen',ySplit:3}];s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
  return w;
}
export async function exportBirthday(o:BirthdayExport){await save(makeBirthdayWorkbook(o),'birthday-paradox');}
