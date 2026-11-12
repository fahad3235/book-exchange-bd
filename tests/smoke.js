// book-exchange-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9362;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/bxb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}))`);
  const setSelect = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  const BN_TITLE = '\u09ac\u0987 \u09ac\u09bf\u09a8\u09bf\u09ae\u09af\u09bc \u09ac\u09bf\u09a1\u09bf';
  const cards = () => ev(`document.querySelectorAll('#list .card').length`);
  const listText = () => ev(`document.getElementById('list').textContent`);

  // ---- Load: defaults ----
  await nav(BASE);
  check('page title is Book Exchange BD', (await ev('document.title')) === 'Book Exchange BD');
  check('4 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 4);
  check('empty list message shown', (await ev(`document.getElementById('listEmpty').style.display`)) !== 'none');
  check('0 cards initially', (await cards()) === 0);
  check('stats all zero', (await ev(`document.getElementById('statTotal').textContent`)) === '0');
  check('avg price shows dash when no sale listings', (await ev(`document.getElementById('statAvg').textContent`)) === '\u2014');
  check('wishlist empty message shown', (await ev(`document.getElementById('wishEmpty').style.display`)) !== 'none');
  check('starts with 0 listings', (await ev(`window.__bx.state.listings.length`)) === 0);
  check('subject select has 14 options', (await ev(`document.getElementById('subject').options.length`)) === 14);
  check('filter subject has 15 options (All + 14)', (await ev(`document.getElementById('fSubject').options.length`)) === 15);

  // ---- Validation: empty submit shows errors, adds nothing ----
  await clickTab('post');
  await ev(`document.getElementById('saveBtn').click()`);
  check('empty title shows error', (await ev(`document.getElementById('err-title').textContent`)) !== '');
  check('empty phone shows error', (await ev(`document.getElementById('err-phone').textContent`)) !== '');
  check('no listing added on invalid save', (await ev(`window.__bx.state.listings.length`)) === 0);

  // ---- Add book A: sale, CSE, 350 Tk ----
  await setVal('title', 'Data Structures in C');
  await setVal('author', 'Seymour Lipschutz');
  await setSelect('subject', 'CSE');
  await setSelect('condition', 'good');
  await ev(`document.querySelector('input[name="type"][value="sale"]').checked = true`);
  await setVal('price', '350');
  await setVal('seller', 'Fahad');
  await setVal('phone', '01712-345678');
  await setVal('area', 'Dhanmondi');
  await setVal('notes', '2nd edition, no highlights');
  await ev(`document.getElementById('saveBtn').click()`);
  check('book A posted message', (await ev(`document.getElementById('formMsg').textContent`)) === 'Book posted.');
  check('back on browse tab after post', (await ev(`document.getElementById('tab-browse').classList.contains('active')`)) === true);
  check('1 card after post', (await cards()) === 1);
  check('card shows title', (await listText()).includes('Data Structures in C'));
  check('card shows price 350 with taka sign', (await listText()).includes('\u09f3350'));
  check('card shows seller phone link', (await ev(`document.querySelector('#list a[href^="tel:"]').getAttribute('href')`)) === 'tel:01712345678');
  check('stat total 1', (await ev(`document.getElementById('statTotal').textContent`)) === '1');
  check('stat available 1', (await ev(`document.getElementById('statAvailable').textContent`)) === '1');
  check('stat avg 350', (await ev(`document.getElementById('statAvg').textContent`)) === '\u09f3350');

  // ---- Bad phone rejected ----
  await clickTab('post');
  await setVal('title', 'Bad Phone Book');
  await setVal('author', 'X');
  await setVal('seller', 'Y');
  await setVal('phone', 'abc');
  await ev(`document.getElementById('saveBtn').click()`);
  check('bad phone shows error', (await ev(`document.getElementById('err-phone').textContent`)) !== '');
  check('still 1 listing after bad phone', (await ev(`window.__bx.state.listings.length`)) === 1);
  await setVal('phone', '01212345678');
  await ev(`document.getElementById('saveBtn').click()`);
  check('012 phone rejected too', (await ev(`document.getElementById('err-phone').textContent`)) !== '');
  await ev(`document.getElementById('cancelEdit').click()`);
  await clickTab('browse');

  // ---- Sale with price 0 rejected ----
  await clickTab('post');
  await setVal('title', 'Zero Price');
  await setVal('author', 'X');
  await setVal('seller', 'Y');
  await setVal('phone', '01712345678');
  await setVal('price', '0');
  await ev(`document.getElementById('saveBtn').click()`);
  check('sale price 0 shows error', (await ev(`document.getElementById('err-price').textContent`)) !== '');
  check('still 1 listing', (await ev(`window.__bx.state.listings.length`)) === 1);
  await clickTab('browse');

  // ---- Add book B: free giveaway ----
  await clickTab('post');
  await setVal('title', 'English Grammar');
  await setVal('author', 'Wren');
  await setSelect('subject', 'English');
  await setSelect('condition', 'fair');
  await ev(`document.querySelector('input[name="type"][value="free"]').checked = true`);
  await setVal('price', '');
  await setVal('seller', 'Meem');
  await setVal('phone', '01912345678');
  await setVal('area', 'Mirpur');
  await setVal('notes', '');
  await ev(`document.getElementById('saveBtn').click()`);
  check('book B posted', (await ev(`window.__bx.state.listings.length`)) === 2);
  check('card shows Free for giveaway', (await listText()).includes('Free'));
  check('stat free 1', (await ev(`document.getElementById('statFree').textContent`)) === '1');
  check('stat avg still 350 (free excluded)', (await ev(`document.getElementById('statAvg').textContent`)) === '\u09f3350');

  // ---- Add book C: swap ----
  await clickTab('post');
  await setVal('title', 'Physics Vol 1');
  await setVal('author', 'Halliday');
  await setSelect('subject', 'Physics');
  await setSelect('condition', 'worn');
  await ev(`document.querySelector('input[name="type"][value="swap"]').checked = true`);
  await setVal('seller', 'Fahad');
  await setVal('phone', '01512345678');
  await setVal('area', '');
  await ev(`document.getElementById('saveBtn').click()`);
  check('book C posted', (await ev(`window.__bx.state.listings.length`)) === 3);
  check('3 cards shown', (await cards()) === 3);

  // ---- Search + filters ----
  await setVal('q', 'physics');
  check('search physics shows 1 card', (await cards()) === 1);
  await setVal('q', 'fahad');
  check('search fahad shows 2 cards', (await cards()) === 2);
  await setVal('q', '');
  await setSelect('fType', 'free');
  check('filter type free shows 1 card', (await cards()) === 1);
  await setSelect('fType', 'all');
  await setSelect('fSubject', 'CSE');
  check('filter subject CSE shows 1 card', (await cards()) === 1);
  await setSelect('fSubject', 'all');
  await setVal('fMaxPrice', '300');
  check('maxPrice 300 shows 2 cards (free + swap)', (await cards()) === 2);
  await setVal('fMaxPrice', '');
  await setSelect('fStatus', 'sold');
  check('filter status sold shows 0 cards', (await cards()) === 0);
  await setSelect('fStatus', 'all');
  check('filters cleared show 3 cards', (await cards()) === 3);

  // ---- Sort: priceDesc puts 350 first; priceAsc puts 0 first ----
  await setSelect('sort', 'priceDesc');
  check('priceDesc first card is Data Structures', (await ev(`document.querySelector('#list .card h3').textContent`)) === 'Data Structures in C');
  await setSelect('sort', 'priceAsc');
  check('priceAsc first card is not Data Structures', (await ev(`document.querySelector('#list .card h3').textContent`)) !== 'Data Structures in C');
  await setSelect('sort', 'title');
  check('title sort first is Data Structures', (await ev(`document.querySelector('#list .card h3').textContent`)) === 'Data Structures in C');
  await setSelect('sort', 'newest');

  // ---- Wishlist: heart on, tab shows it, heart off removes ----
  await ev(`document.querySelector('#list .card .heart').click()`);
  check('wishCount 1 after heart', (await ev(`document.getElementById('wishCount').textContent`)) === '1');
  await clickTab('wishlist');
  check('wishlist tab shows 1 card', (await ev(`document.querySelectorAll('#wishList .card').length`)) === 1);
  check('wishlist empty hidden', (await ev(`document.getElementById('wishEmpty').style.display`)) === 'none');
  await ev(`document.querySelector('#wishList .card .heart').click()`);
  check('wishCount 0 after un-heart', (await ev(`document.getElementById('wishCount').textContent`)) === '0');
  await clickTab('browse');

  // ---- Status transitions: reserve -> sold -> available ----
  await ev(`document.querySelector('[data-act="reserve"]').click()`);
  check('reserved badge appears', (await listText()).includes('Reserved'));
  check('stat available drops to 2', (await ev(`document.getElementById('statAvailable').textContent`)) === '2');
  await ev(`document.querySelector('[data-act="sold"]').click()`);
  check('sold badge appears', (await listText()).includes('Sold'));
  await ev(`document.querySelector('[data-act="available"]').click()`);
  check('available again', (await listText()).includes('Available'));

  // ---- Edit: price 350 -> 300 (sort by title so Data Structures is first) ----
  await ev(`window.confirm = function(){ return true; }`);
  await setSelect('sort', 'title');
  await ev(`document.querySelector('[data-act="edit"]').click()`);
  check('edit mode shows cancel', (await ev(`document.getElementById('cancelEdit').style.display`)) !== 'none');
  check('edit form prefilled title', (await ev(`document.getElementById('title').value`)) === 'Data Structures in C');
  await setVal('price', '300');
  await ev(`document.getElementById('saveBtn').click()`);
  check('edit saved message', (await ev(`document.getElementById('formMsg').textContent`)) === 'Listing updated.');
  check('card now shows 300', (await listText()).includes('\u09f3300'));
  check('stat avg now 300', (await ev(`document.getElementById('statAvg').textContent`)) === '\u09f3300');

  // ---- Delete the last card (Physics, title sort) ----
  const beforeDelete = await ev(`window.__bx.state.listings.length`);
  await ev(`var btns=document.querySelectorAll('[data-act="delete"]'); btns[btns.length-1].click()`);
  check('delete removes a listing', (await ev(`window.__bx.state.listings.length`)) === beforeDelete - 1, 'before=' + beforeDelete);
  check('Physics gone after delete', !(await ev(`window.__bx.exportPayload()`)).includes('Physics Vol 1'));

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__bx.exportPayload()`);
  check('export payload is book-exchange-bd v1', payload.includes('"app":"book-exchange-bd"') && payload.includes('"version":1'), payload.slice(0, 120));
  check('export carries Data Structures', payload.includes('Data Structures in C'));
  await ev(`window.__bx.eraseAll()`);
  check('eraseAll empties listings', (await ev(`window.__bx.exportPayload()`)).includes('"listings":[]'));
  check('eraseAll shows empty message', (await ev(`document.getElementById('listEmpty').style.display`)) !== 'none');
  const imp = await ev(`JSON.stringify(window.__bx.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores Data Structures', (await ev(`window.__bx.exportPayload()`)).includes('Data Structures in C'));
  const badImp = await ev(`JSON.stringify(window.__bx.importPayload('{"app":"zakat-calculator-bd","version":1,"listings":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__bx.exportPayload()`)).includes('Data Structures in C'));

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await ev(`document.getElementById('langBn').click()`);
  check('BN toggle: h1 in Bengali', (await ev(`document.querySelector('h1').textContent`)) === BN_TITLE);
  check('BN toggle: tab label in Bengali', (await ev(`document.querySelector('[data-tab="browse"]').textContent`)).includes('\u09ac\u0987 \u09a6\u09c7\u0996\u09c1\u09a8'));
  check('BN toggle: price in Bengali digits', (await listText()).includes('\u09f3\u09e9\u09e6\u09e6'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__bx.lang`)) === 'bn');
  check('BN persists: stats in Bengali digits', (await ev(`document.getElementById('statTotal').textContent`)) === '\u09e8');
  await ev(`document.getElementById('langEn').click()`);
  check('back to EN', (await ev(`window.__bx.lang`)) === 'en');

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await clickTab('data');
  await ev(`document.getElementById('eraseConfirm').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word shows hint', (await ev(`document.getElementById('dataMsg').textContent`)) !== '');
  check('wrong erase keeps data', (await ev(`window.__bx.exportPayload()`)).includes('Data Structures in C'));
  await ev(`document.getElementById('eraseConfirm').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__bx.exportPayload()`)).includes('"listings":[]'));
  check('erase success message shows', (await ev(`document.getElementById('dataMsg').textContent`)) === 'All data erased.');

  // ---- Footer disclaimer ----
  check('footer mentions not a shop', (await ev(`document.querySelector('footer').textContent`)).includes('not a shop'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['browse', 'post', 'wishlist', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
