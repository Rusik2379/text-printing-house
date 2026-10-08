import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
const base=process.env.STICKER_TEST_URL||'http://127.0.0.1:4173/';
try{
 for(const slug of ['etiketki','uv-dtf-nakleyki']){
  await page.goto(new URL('nakleyki-i-stikery/'+slug+'/',base).href,{waitUntil:'networkidle'});
  await page.locator('[data-sp-group="shape"][data-sp-value="round"]').click();
  await page.locator('[data-sp-group="size"][data-sp-value="custom"]').click();
  await page.locator('#sp-width').fill('80');
  await page.locator('[data-sp-group="shape"][data-sp-value="rectangle"]').click();
  assert.equal(await page.locator('#sp-width').inputValue(),'80');
  assert.equal(await page.locator('#sp-height').inputValue(),'80','Rectangle must preserve the current circle diameter in both fields');
  await page.locator('#sp-copy').click();
  const text=await page.evaluate(()=>navigator.clipboard.readText());
  assert.ok(text.includes('width=80&height=80'));
  await page.locator('#sp-add').click();
  await page.waitForFunction(()=>TEXT_APP.getCart().some(item=>item.configuration?.width===80&&item.configuration?.height===80));
  await page.locator('.cart-button').click();
  const edit=await page.locator('.cart-edit-link').last().getAttribute('href');
  await page.goto(edit,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#sp-height').inputValue(),'80','Cart edit must retain the corrected height');
 }
 console.log('Custom circle → rectangle keeps 80 × 80 mm in the form, copied URL and cart edit for labels and UV-DTF.');
}finally{await browser.close();}
