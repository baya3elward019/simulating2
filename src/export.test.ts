import {it,expect} from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeWorkbook,makeChanceWorkbook} from './export';
import {simulate,singleIAT,singleST,pdfIAT,pdfA,pdfB,type Config} from './engine';
import {queueLayout,queueFormulas,chanceFormulas} from './excelFormulas';

it('exports one sheet with live randomness, lookup, server state and matching teaching formulas',async()=>{
  const c:Config={n:4,iat:[{value:1,p:1}],a:[{value:3,p:1}],b:[{value:3,p:1}],zero:true,seed:'export'};
  const w=await makeWorkbook(simulate(c),c),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await w.xlsx.writeBuffer());
  expect(loaded.worksheets).toHaveLength(1);
  const zip=await JSZip.loadAsync(await w.xlsx.writeBuffer());expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('fullCalcOnLoad="1"');
  const s=loaded.worksheets[0],{first}=queueLayout(c);
  for(const cell of queueFormulas(c,first+1))expect(s.getCell(cell.address).formula).toBe(cell.formula);
  expect(s.getCell(`B${first}`).formula).toBe('RAND()');expect(s.getCell(`G${first}`).formula).toContain('VLOOKUP');
  expect(s.getCell(`M${first+1}`).formula).toBe(`O${first}`);expect(s.getCell(`N${first+1}`).formula).toBe(`P${first}`);
  expect(s.getCell(`F${first}`).formula).toContain('$U$4="random"');expect(s.getCell('U19').formula).toContain('MAX(R');
});
it('exports all nine die cell formulas and a live coin, without batch sheets',()=>{
  for(const dice of [false,true]){const w=makeChanceWorkbook(dice);expect(w.worksheets).toHaveLength(1);for(const c of chanceFormulas(dice))expect(w.worksheets[0].getCell(c.address).formula).toBe(c.formula);}
  expect(chanceFormulas(true)).toHaveLength(10);
});
it('exports exponential formulas for M/M/1 instead of discrete lookup',async()=>{
  const c:Config={n:3,iat:singleIAT,a:singleST,zero:false,seed:'mm',lambda:2,mu:3};const w=await makeWorkbook(simulate(c),c),{first}=queueLayout(c),s=w.worksheets[0];
  expect(s.getCell(`C${first}`).formula).toContain('-LN(1-B');expect(s.getCell(`G${first}`).formula).toContain('/$U$6');expect(s.getCell('U31').formula).toContain('No finite steady state');
});
it('writes representative fixtures for native Excel recalculation verification',async()=>{
  const dir=`tmp/excel-qa-${Date.now()}`;await mkdir(dir,{recursive:true});const fixtures:Record<string,Config>={single:{n:20,iat:singleIAT,a:singleST,zero:false,seed:'qa'},two:{n:20,iat:pdfIAT,a:pdfA,b:pdfB,zero:false,seed:'qa',mode:'shared'},mm1:{n:20,iat:singleIAT,a:singleST,zero:false,seed:'qa',lambda:2,mu:3}};
  const meta:Record<string,unknown>={};for(const [name,c] of Object.entries(fixtures)){await (await makeWorkbook(simulate(c),c)).xlsx.writeFile(`${dir}/${name}.xlsx`);meta[name]=queueLayout(c);}
  for(const dice of [false,true])await makeChanceWorkbook(dice).xlsx.writeFile(`${dir}/${dice?'dice':'coin'}.xlsx`);
  await writeFile(`${dir}/layout.json`,JSON.stringify(meta));await writeFile('tmp/latest-excel-qa.txt',dir);
});
