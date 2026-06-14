const puppeteer = require('puppeteer');
const fs = require('fs');

const delay = ms => new Promise(res => setTimeout(res, ms));

const THEMES = ['Tháp Rùa', 'Khue Van Cac Gemini', 'Cyclades'];
// representative times across the full day/night cycle
const TIMES = [
  { label: 'noon', t: 12 },
  { label: 'morning', t: 8 },
  { label: 'dusk', t: 18.5 },
  { label: 'night', t: 22 },
  { label: 'midnight', t: 0.5 },
];

async function setTime(page, t) {
  await page.evaluate((val) => {
    const slider = document.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(slider, String(val));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }, t);
}

async function selectTheme(page, name) {
  const clicked = await page.evaluate((nm) => {
    const btn = Array.from(document.querySelectorAll('.theme-tab')).find(b => b.textContent.trim() === nm);
    if (btn) { btn.click(); return true; }
    return false;
  }, name);
  if (!clicked) throw new Error(`theme tab not found: ${name}`);
}

async function currentUrl(page) {
  return page.evaluate(() => document.querySelector('.url-input')?.value);
}

async function setScanView(page) {
  // Click "Top-down (scan)" if present (we may already be in scan)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /Top-down/.test(b.textContent));
    if (btn) btn.click();
  });
}

async function scanCheck(page) {
  return page.evaluate(() => window.__scanCheck());
}

async function dumpCanvas(page, file) {
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  fs.writeFileSync(file, dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173');
  await delay(2500);

  const results = [];
  for (const theme of THEMES) {
    await selectTheme(page, theme);
    await delay(800);
    console.log(`\n[${theme}] loaded URL: ${await currentUrl(page)}`);
    // go to scan (top-down) view once per theme
    await setScanView(page);
    await delay(1600); // let the camera + fold transition settle

    for (const { label, t } of TIMES) {
      await setTime(page, t);
      await delay(900); // lighting eases over ~1s

      // poll a few times — the canvas renders on demand
      let res = { ok: false, decoded: null };
      for (let i = 0; i < 8; i++) {
        res = await scanCheck(page);
        if (res.ok) break;
        await delay(250);
      }
      const tag = `${theme} @ ${label}(${t})`;
      results.push({ tag, ok: res.ok, decoded: res.decoded });
      console.log(`${res.ok ? 'PASS' : 'FAIL'}  ${tag}  decoded=${res.decoded ? JSON.stringify(res.decoded.slice(0, 40)) : 'null'}`);
      if (!res.ok) {
        const safe = tag.replace(/[^a-z0-9]+/gi, '_');
        await dumpCanvas(page, `fail-${safe}.png`);
      }
    }
  }

  const passCount = results.filter(r => r.ok).length;
  console.log(`\n${passCount}/${results.length} passed`);
  await browser.close();
  process.exit(passCount === results.length ? 0 : 1);
})();
