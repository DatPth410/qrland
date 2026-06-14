const puppeteer = require('puppeteer');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await delay(3000); // wait for 3D render
  
  // switch to Cyclades
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cyclades = btns.find(b => b.textContent.includes('Cyclades'));
    if (cyclades) cyclades.click();
  });
  
  await delay(2000);
  
  // click scan check
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check scannability'));
    if (btn) btn.click();
  });
  
  await delay(2000); // wait for scan transition
  
  const scanResult = await page.evaluate(() => {
    return window.__scanCheck();
  });
  
  console.log('CYCLADIC SCAN RESULT:', scanResult);
  await browser.close();
})();
