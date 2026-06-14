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
  
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas.toDataURL();
  });
  
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync("canvas-dump.png", base64Data, 'base64');
  console.log('Saved canvas-dump.png');
  await browser.close();
})();
