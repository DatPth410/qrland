const puppeteer = require('puppeteer');
const fs = require('fs');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await delay(3000); // wait for 3D render
  
  // click scan check
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check scannability'));
    if (btn) btn.click();
  });
  
  await delay(1500); // wait for scan transition
  
  await page.screenshot({ path: 'scan-view.png' });
  console.log('Saved scan-view.png');
  await browser.close();
})();
