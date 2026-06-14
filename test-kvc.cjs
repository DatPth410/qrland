const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));
const ev = (p,f,...a)=>p.evaluate(f,...a);
const URLS = ['a','https://x.io','https://anthropic.com',
  'https://en.wikipedia.org/wiki/Temple_of_Literature,_Hanoi',
  'https://en.wikipedia.org/wiki/Hoan_Kiem_Lake?x=padding-to-grow-version-1234567890'];
const TIMES=[{l:'day',t:12},{l:'night',t:22}];
(async () => {
  const b = await puppeteer.launch();
  const p = await b.newPage();
  await p.setViewport({ width: 880, height: 880, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5173'); await delay(2500);
  let pass=0,total=0; const fails=[];
  for (const theme of ['Khue Van Cac Gemini','Tháp Rùa','Cyclades']) {
    const urls = theme==='Khue Van Cac Gemini' ? URLS : URLS.slice(2,4);
    await ev(p, t=>{const x=[...document.querySelectorAll('.theme-tab')].find(b=>b.textContent.trim()===t);x&&x.click();}, theme);
    await delay(700);
    await ev(p, ()=>{const x=[...document.querySelectorAll('button')].find(b=>/Top-down/.test(b.textContent));x&&x.click();});
    await delay(1400);
    for (const url of urls) {
      await ev(p, u=>{const i=document.querySelector('.url-input');const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(i,u);i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}, url);
      await delay(1200);
      for (const {l,t} of TIMES) {
        await ev(p, v=>{const s=document.querySelector('input[type=range]');const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;set.call(s,String(v));s.dispatchEvent(new Event('input',{bubbles:true}));}, t);
        await delay(700);
        let r={ok:false}; for(let i=0;i<10;i++){r=await ev(p,()=>window.__scanCheck());if(r.ok)break;await delay(220);}
        total++; if(r.ok)pass++; else fails.push(`${theme} | ${l} | ${JSON.stringify(url).slice(0,28)}`);
        console.log(`${r.ok?'PASS':'FAIL'} ${theme.slice(0,12)} ${l} ${JSON.stringify(url).slice(0,30)}`);
      }
    }
  }
  console.log(`\n${pass}/${total} passed`);
  if(fails.length) console.log('FAILS:\n'+fails.join('\n'));
  await b.close(); process.exit(fails.length?1:0);
})();
