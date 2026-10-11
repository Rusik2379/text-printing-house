import assert from 'node:assert/strict';
import fs from 'node:fs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const base=process.env.PROJECT_TEST_URL||'http://127.0.0.1:4187/';
const content=JSON.parse(fs.readFileSync(new URL('../project-content.json',import.meta.url),'utf8'));
const output=process.env.PROJECT_SCREENSHOTS;
if(output)fs.mkdirSync(output,{recursive:true});
let flows=0;
try{
  for(const id of ['2.1','2.5','2.6']){
    const service=content.services.find(s=>s.id===id),countCol=id==='2.6'?'E':'D',colourCol=id==='2.6'?'D':'C';
    for(const width of [320,390,768,1440]){
      const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>localStorage.setItem('text-print-consent-v1',JSON.stringify({version:1,analytics:false,updatedAt:new Date().toISOString()})));
      if(width===1440)await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopiedCalculation=text;}}}));
      await page.goto(new URL(service.path,base).href);
      assert.equal(await page.locator('.project-reference-layout').count(),1,'Large calculator uses the reference illustration-and-card composition');
      const cell=(index,col)=>page.locator(`[data-project-index="${index}"][data-project-row-cell="${col}"]`);
      const rows=page.locator('[data-project-row]');
      const extras=page.locator('.project-calc-extra');
      const priceDetails=page.locator('[data-cc-breakdown-panel]');
      const openExtras=async()=>{if(!await priceDetails.evaluate(el=>el.open))await priceDetails.locator('summary').first().click();if(!await extras.evaluate(el=>el.open))await extras.locator('summary').click();};
      const reset=async()=>{await openExtras();await page.locator('[data-cc-reset]').click();await extras.locator('summary').click();await priceDetails.locator('summary').first().click();};
      assert.equal(await cell(0,'B').count(),1,'Every row, including the first, has a complete format selector');
      assert.ok(await cell(0,'B').locator('option[value="A3"]').count(),'Standard and extended formats share one selector');
      if(width===1440){
        // Independent workbook examples prove that selects really update the quote.
        await cell(0,'B').selectOption(id==='2.6'?'A3':'A1');
        await cell(0,colourCol).selectOption('Ч/Б');
        await cell(0,countCol).fill(id==='2.6'?'20':'5');
        await page.locator('[data-project-add]').click();
        await cell(1,'B').selectOption(id==='2.6'?'A3':'A2');
        await cell(1,colourCol).selectOption('Цвет');
        await cell(1,countCol).fill('10');
        if(id==='2.6')await cell(1,'C').selectOption('Color Copy 200 г/м²');
        else await page.locator('[data-project-select="B4"]').selectOption('Под A4');
        assert.equal(await page.locator('[data-cc-total]').textContent(),id==='2.6'?'1 200 ₽':'1 590 ₽');
        if(id!=='2.6'){
          await page.locator('[data-project-select="B5"]').selectOption('Да');
          assert.equal(await page.locator('[data-project-select="B6"]').count(),1,'Binding reveals its options');
          assert.equal(await cell(1,countCol).inputValue(),'10','Changing processing retains every row');
          await page.locator('[data-project-select="B6"]').selectOption('Металл');
          assert.ok(await page.locator('[data-project-select="B8"] option').count());
        }
        await reset();
      }
      await cell(0,'B').selectOption(id==='2.6'?'A4':'A4x3');
      await cell(0,countCol).fill('13');
      await page.locator('[data-project-add]').click();
      assert.equal(await rows.count(),2);
      assert.equal(await cell(1,'B').evaluate(el=>el===document.activeElement),true,'New row receives keyboard focus');
      await cell(1,'B').selectOption('A3');
      await cell(1,colourCol).selectOption('Цвет');
      if(id==='2.6')await cell(1,'C').selectOption('Color Copy 200 г/м²');
      await cell(1,countCol).fill('7');
      await page.locator('[data-project-add]').click();
      await cell(2,'B').selectOption('A3');
      await cell(2,colourCol).selectOption('Цвет');
      if(id==='2.6')await cell(2,'C').selectOption('Color Copy 200 г/м²');
      await cell(2,countCol).fill('4');
      assert.equal(await cell(1,countCol).inputValue(),'7','Each row retains its own quantity');
      assert.equal(await cell(0,countCol).inputValue(),'13');
      await page.locator('[data-project-remove="0"]').click();
      assert.equal(await cell(0,countCol).inputValue(),'7','Deleting shifts rows without losing remaining inputs');
      await cell(1,countCol).fill('0');
      assert.equal(await page.locator('[data-cc-add]').isDisabled(),true);
      assert.equal(await cell(1,countCol).getAttribute('aria-invalid'),'true');
      await cell(1,countCol).fill('4');
      assert.equal(await page.locator('[data-cc-add]').isDisabled(),false);
      const layout=await page.evaluate(()=>{
        const rect=selector=>document.querySelector(selector).getBoundingClientRect();
        const list=document.querySelector('.project-sheet-list'),result=rect('.cc-result'),art=rect('.project-service-visual'),card=rect('#calculator'),upload=rect('.project-upload');
        const rowControls=[...list.firstElementChild.children].filter(el=>el.matches('select,input')).map(el=>({col:el.dataset.projectRowCell,top:el.getBoundingClientRect().top}));
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,rows:[...list.children].map(el=>el.getBoundingClientRect().height),resultTop:result.top,listBottom:list.getBoundingClientRect().bottom,uploadBottom:upload.bottom,art:{left:art.left,right:art.right,bottom:art.bottom},card:{left:card.left,top:card.top,width:card.width},result:{left:result.left,width:result.width},rowControls};
      });
      assert.equal(layout.overflow,false,'Multirow calculator fits the screen');
      if(width>=768)assert.ok(layout.rows.every(height=>height<=110),'Rows remain compact even for the first format');
      assert.ok(layout.resultTop>=layout.listBottom,'Order result follows the complete list');
      assert.ok(layout.resultTop>=layout.uploadBottom,'Upload comes before the result, as in the reference');
      assert.ok(Math.abs(layout.card.left-layout.result.left)<=1&&Math.abs(layout.card.width-layout.result.width)<=2,'Price and upload belong to the same card');
      if(width===1440)assert.ok(layout.card.left>layout.art.right,'Desktop illustration sits to the left of the calculator');
      else assert.ok(layout.card.top>=layout.art.bottom,'Mobile/tablet illustration sits above the calculator');
      const firstLine=layout.rowControls.filter(control=>id!=='2.6'||width>580||control.col!=='C');
      assert.ok(firstLine.every(control=>Math.abs(control.top-firstLine[0].top)<1),'Compact row controls stay on one line');
      if(id==='2.6'&&width<=580)assert.ok(layout.rowControls.find(control=>control.col==='C').top>firstLine[0].top,'Paper occupies the next line on a narrow screen');
      if(output&&[390,1440].includes(width)){
        await cell(1,countCol).blur();
        await page.locator('.project-reference-layout').screenshot({path:`${output}/${id}-${width}.png`});
      }
      if(width===1440){
        await openExtras();await page.locator('[data-cc-comment]').fill('Сохранить порядок листов');
        await page.locator('[data-cc-file]').setInputFiles({name:'project-test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% browser fixture')});
        await page.locator('[data-cc-copy]').click();
        await page.waitForFunction(()=>window.testCopiedCalculation);
        const copied=await page.evaluate(()=>window.testCopiedCalculation);
        assert.ok(copied.includes('project-test.pdf')&&copied.includes('Сохранить порядок листов'),'Copy retains file metadata and comment');
        assert.equal(JSON.parse(new URL(copied.split('\n').find(line=>line.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length)).searchParams.get('calc')).rows.length,2);
      }
      await page.locator('[data-cc-add]').click();
      await page.waitForFunction(()=>TEXT_APP.getCart().length===1);
      const saved=await page.evaluate(()=>TEXT_APP.getCart()[0]);
      assert.equal(saved.configuration.rows.length,2);
      assert.equal(saved.configuration.rows[0][countCol],7);
      assert.equal(saved.configuration.rows[1][countCol],4);
      assert.equal(saved.configuration.rows[0][colourCol],'Цвет');
      if(width===1440)assert.equal(saved.fileName,'project-test.pdf');
      const share=new URL(new URL(service.path,base));share.searchParams.set('calc',JSON.stringify(saved.configuration));
      await page.goto(share.href);
      assert.equal(await rows.count(),2);assert.equal(await cell(1,countCol).inputValue(),'4');
      await page.goto(new URL(service.path+'?edit='+saved.key,base).href);
      await cell(0,countCol).fill('9');await page.locator('[data-cc-add]').click();
      const edited=await page.evaluate(()=>TEXT_APP.getCart());
      assert.equal(edited.length,1,'Editing updates the existing cart item');
      assert.equal(edited[0].configuration.rows[0][countCol],9);
      if(width===1440){
        assert.equal(edited[0].fileName,'project-test.pdf','Editing keeps the uploaded file');
        assert.equal(await page.locator('[data-cc-comment]').inputValue(),'Сохранить порядок листов');
        await page.locator('[data-cc-remove-file]').click();await page.locator('[data-cc-add]').click();
        assert.equal(await page.evaluate(()=>TEXT_APP.getCart()[0].fileName),undefined,'The file can be removed from the edited order');
        await reset();
        assert.equal(await page.locator('[data-project-remove="0"]').isDisabled(),true,'The last row cannot be deleted');
        const limit=id==='2.6'?5:20;
        for(let i=1;i<limit;i++)await page.locator('[data-project-add]').click();
        assert.equal(await rows.count(),limit);
        assert.equal(await page.locator('[data-project-add]').isDisabled(),true);
        assert.equal(await page.locator('[data-project-duplicate]').count(),0,'The reference has only one remove control per row');
        await openExtras();
        await page.locator('[data-cc-comment]').fill('Проверка полного комплекта');
        const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-cc-download]').click()]);
        const text=fs.readFileSync(await download.path(),'utf8');
        assert.ok(text.includes('Проверка полного комплекта'));
        assert.ok(text.includes(`${limit}. Формат:`),'Downloaded calculation includes the last row');
        const url=new URL(text.split('\n').find(line=>line.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length));
        assert.equal(JSON.parse(url.searchParams.get('calc')).rows.length,limit);
        await page.goto(url.href);assert.equal(await rows.count(),limit,'Shared links restore the full row limit');
      }
      assert.equal(errors.length,0,errors.join('\n'));await page.close();flows++;
    }
  }
  console.log(`Multirow calculators: ${flows} desktop/mobile flows passed (rows, prices, validation, focus, cart, editing and shared links).`);
}finally{await browser.close();}
