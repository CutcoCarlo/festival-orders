/* Festival Orders — offline order capture modeled on the Cutco Orders app.
   Everything is stored on the phone (localStorage). Card data is encrypted with a key
   derived from the PIN and is never exported. */
'use strict';

const APP_VERSION = '1.5.2';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = n => Math.round((+n || 0) * 100) / 100;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${m}/${d}/${y}`; };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

/* ---------- storage ---------- */
const LS = {
  read(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save (storage full?)'); return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
let ORDERS = LS.read('fo.orders', []);
let SETTINGS = Object.assign({ taxRate: 9.5, event: '', customerType: CUSTOMER_TYPES[0], orderType: 'Regular', email: '', repName: '', bonusLimit: 15, hideCpo: false }, LS.read('fo.settings', {}));
const bonusLimit = () => Math.min(30, Math.max(0, +SETTINGS.bonusLimit || 0));
function applyCustomerView() { document.body.classList.toggle('hidecpo', !!SETTINGS.hideCpo); const b = $('#btnEye'); if (b) b.classList.toggle('on', !!SETTINGS.hideCpo); }
let PRICE_OVR = LS.read('fo.prices', {});      // { itemNumber: price }
let CUSTOM_ITEMS = LS.read('fo.custom', []);   // [{n,name,p,c:'custom'}]
const saveOrders = () => LS.write('fo.orders', ORDERS);
const saveSettings = () => LS.write('fo.settings', SETTINGS);

const keyOf = i => i.b + (i.sfx || '') + (i.out ? i.out[0] : '');
function allProducts() {
  return CATALOG.map(i => { const k = keyOf(i); const p = PRICE_OVR[k] != null ? PRICE_OVR[k] : i.p; return Object.assign({}, i, { key: k, p }); })
    .concat(CUSTOM_ITEMS.map(c => Object.assign({ cpo: 0, pts: 0 }, c, { key: c.b, custom: true })));
}
/* Product photos live in sprite sheets (imglist.js). Returns a style string for a square of `size` px, or '' if no photo. */
function spriteStyle(key, size) {
  const S = typeof IMG_SPRITES !== 'undefined' ? IMG_SPRITES : null; if (!S) return '';
  const p = S.pos[String(key || '').replace(/[^A-Za-z0-9]/g, '_')]; if (!p) return '';
  const k = size / S.cell; const rows = Math.ceil(Object.values(S.pos).filter(x => x[0] === p[0]).length / S.cols);
  return `background-image:url(${S.sheets[p[0]]});background-size:${S.cols * size}px ${rows * size}px;background-position:${-p[1] * size}px ${-p[2] * size}px`;
}
const hasImg = key => !!spriteStyle(key, 1);
const isGiftOrder = o => GIFT_ORDER_TYPES.includes(o.info.orderType);
const unitPrice = (it, o) => (isGiftOrder(o) && it.g != null) ? it.g : it.p;
/* Item number as Cutco writes it: base + handle color letter + suffix, plus R for a cherry-finish block. */
function itemNo(l) {
  if (!l.b) return l.n || '';
  let n = l.b;
  if (l.out) n += (l.opts.out || l.out[0]);
  else if (l.col) n += (l.opts.color || l.col[0]);
  n += (l.sfx || '');
  if (l.ch && l.opts.cherry) n += 'R';
  return n;
}
function lineDesc(l) {
  const bits = [];
  if (l.col) bits.push(COLOR_NAMES[l.opts.color || l.col[0]]);
  if (l.out) bits.push(OUTDOOR_COLORS[l.opts.out || l.out[0]]);
  if (l.ch) bits.push(l.opts.cherry ? 'Cherry finish' : 'Honey finish');
  (l.o || []).forEach(g => { if (l.opts[g]) bits.push(l.opts[g]); });
  return bits.join(', ');
}
function lineCpo(l) { const q = +l.qty || 0; if (l.gc) return r2(q * (+l.price || 0) * 0.8); return q * (+l.cpo || 0); }

/* ---------- tax rates ---------- */
let TAX = LS.read('fo.taxdata', null) || (typeof TAX_DATA !== 'undefined' ? TAX_DATA : { cities: {}, counties: {}, zips: {}, updated: '' });
function taxAddress(o) { return (o.shipReq && !o.shipSame) ? o.ship : o.bill; }
function estimateRate(a) {
  const st = (a.state || '').toUpperCase(), city = (a.city || '').trim().toUpperCase(), zip = (a.zip || '').trim().slice(0, 5);
  if (st && st !== 'CA') return { rate: null, source: 'other', label: 'Not a California address' };
  if (city && TAX.cities[city]) return { rate: TAX.cities[city][0] * 100, source: 'city', label: 'City table: ' + city.replace(/\w\S*/g, w => w[0] + w.slice(1).toLowerCase()) };
  const county = TAX.zips[zip]; if (county && TAX.counties[county] != null) return { rate: TAX.counties[county] * 100, source: 'county', label: 'County table (unincorporated ' + county.replace(/\w\S*/g, w => w[0] + w.slice(1).toLowerCase()) + ')' };
  return { rate: null, source: 'default', label: 'No match, using default rate' };
}
async function lookupExactRate(a) {
  const q = [a.addr1, a.city, a.state || 'CA', a.zip].filter(Boolean).join(', ');
  if (!a.addr1 || !(a.city || a.zip)) throw new Error('Need street, city or ZIP');
  const g = await (await fetch('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&forStorage=false&SingleLine=' + encodeURIComponent(q))).json();
  const c = g.candidates && g.candidates[0]; if (!c || c.score < 80) throw new Error('Address not found');
  const u = 'https://services6.arcgis.com/snwvZ3EmaoXJiugR/arcgis/rest/services/California_Sales_and_Use_Tax_Rates/FeatureServer/1/query?f=json&returnGeometry=false&outFields=JURIS_NAME,City_Name_Proper,County_name,RATE&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&geometry=' + c.location.x + ',' + c.location.y;
  const r = await (await fetch(u)).json();
  const f = r.features && r.features[0]; if (!f) throw new Error('No California tax area at that address');
  const at = f.attributes;
  return { rate: at.RATE * 100, source: 'exact', label: 'Exact: ' + (at.City_Name_Proper === 'Unincorporated' ? 'Unincorporated ' + at.County_name : at.City_Name_Proper) + ' (' + c.address + ')' };
}
async function refreshTaxTable() {
  const u = 'https://services6.arcgis.com/snwvZ3EmaoXJiugR/arcgis/rest/services/California_Sales_and_Use_Tax_Rates/FeatureServer/1/query?where=1%3D1&outFields=City_Name_Proper,County_name,RATE&returnGeometry=false&resultRecordCount=2000&f=json';
  const d = await (await fetch(u)).json(); if (!d.features || d.features.length < 100) throw new Error('bad data');
  const cities = {}, counties = {};
  d.features.forEach(f => { const a = f.attributes; const co = (a.County_name || '').toUpperCase(), ci = (a.City_Name_Proper || '').trim(); if (ci.toUpperCase() === 'UNINCORPORATED') counties[co] = a.RATE; else cities[ci.toUpperCase()] = [a.RATE, co]; });
  TAX = { updated: today(), cities, counties, zips: TAX.zips }; LS.write('fo.taxdata', TAX); return TAX;
}
function maybeAutoRefreshTax() {
  if (!navigator.onLine) return;
  const last = TAX.updated || ''; const age = (Date.now() - new Date(last || '2000-01-01').getTime()) / 864e5;
  if (age > 7) refreshTaxTable().catch(() => {});
}
async function applyTax(o, opts = {}) {
  if (!o.pay.taxable) return;
  if (o.pay.taxSource === 'manual' && !opts.force) return;
  const a = taxAddress(o);
  const est = estimateRate(a);
  if (est.rate != null) { o.pay.taxRate = r2(est.rate); o.pay.taxSource = est.source; o.pay.taxJuris = est.label; }
  else { o.pay.taxRate = o.pay.taxSource === 'exact' ? o.pay.taxRate : SETTINGS.taxRate; o.pay.taxSource = est.source; o.pay.taxJuris = est.label; }
  if (est.source === 'other') { o.pay.taxRate = SETTINGS.taxRate; o.pay.taxJuris = 'Not California: enter the rate yourself'; }
  if (navigator.onLine && est.source !== 'other' && a.addr1 && (opts.online !== false)) {
    try { const ex = await lookupExactRate(a); if (cur === o) { o.pay.taxRate = r2(ex.rate); o.pay.taxSource = 'exact'; o.pay.taxJuris = ex.label; renderTaxBox(); updateTotal(); persistCur(); } } catch (e) { /* offline or not found: keep estimate */ }
  }
}

/* ---------- toast / modal ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }
function openSheet(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; }
function closeSheet() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeSheet(); });
function confirmSheet(title, body, okLabel, danger) {
  return new Promise(res => {
    openSheet(`<h3>${h(title)}</h3><p>${body}</p><div class="acts"><button class="btn" id="mCancel">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="mOk">${h(okLabel || 'OK')}</button></div>`);
    $('#mCancel').onclick = () => { closeSheet(); res(false); };
    $('#mOk').onclick = () => { closeSheet(); res(true); };
  });
}

/* ---------- crypto (PIN → key, AES-GCM for card data) ---------- */
const CR = {
  ok: !!(window.crypto && crypto.subtle && window.isSecureContext),
  b64: b => btoa(String.fromCharCode(...new Uint8Array(b))),
  unb64: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
  async derive(pin, saltB64) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode('fo:' + pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: CR.unb64(saltB64), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async enc(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: CR.b64(iv), ct: CR.b64(ct) };
  },
  async dec(key, rec) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: CR.unb64(rec.iv) }, key, CR.unb64(rec.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
};
let KEY = null;            // in-memory key while unlocked
let PINREC = LS.read('fo.pin', null);   // { salt, check:{iv,ct} }

async function setPin(pin) {
  const salt = CR.b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await CR.derive(pin, salt);
  const check = await CR.enc(key, { ok: true });
  PINREC = { salt, check }; LS.write('fo.pin', PINREC); KEY = key;
}
async function tryPin(pin) {
  try { const key = await CR.derive(pin, PINREC.salt); const o = await CR.dec(key, PINREC.check); if (o && o.ok) { KEY = key; return true; } } catch (e) {}
  return false;
}
async function rekeyAll(newPin) {
  // decrypt every card with the current key, re-encrypt with the new one
  const cards = [];
  for (const o of ORDERS) { if (o.card) { try { cards.push([o, await CR.dec(KEY, o.card)]); } catch (e) { cards.push([o, null]); } } }
  await setPin(newPin);
  for (const [o, c] of cards) o.card = c ? await CR.enc(KEY, c) : null;
  saveOrders();
}

/* ---------- lock screen ---------- */
const lock = { mode: 'enter', buf: '', first: '' };
function showLock() {
  KEY = null; show('lock'); lock.buf = ''; lock.first = '';
  const note = $('#lockNote');
  if (!CR.ok) {
    lock.mode = 'blocked';
    $('#lockMsg').textContent = 'Secure connection needed';
    note.hidden = false; note.textContent = 'Open this app from its https address (or from the home-screen icon) so card data can be encrypted.';
    $('#pinPad').innerHTML = ''; $('#btnForgot').hidden = true; return;
  }
  note.hidden = true; $('#btnForgot').hidden = !PINREC;
  lock.mode = PINREC ? 'enter' : 'set';
  $('#lockMsg').textContent = PINREC ? 'Enter your PIN' : 'Create a PIN (4 to 6 digits)';
  $('#lockErr').hidden = true;
  if (!$('#pinPad').children.length) {
    $('#pinPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'OK'].map(k => `<button data-k="${k}" class="${/\d/.test(k) ? '' : 'fn'}">${k}</button>`).join('');
  }
  drawDots();
}
function drawDots() { $('#pinDots').innerHTML = Array.from({ length: Math.max(4, lock.buf.length) }, (_, i) => `<i class="${i < lock.buf.length ? 'on' : ''}"></i>`).join(''); }
$('#pinPad').addEventListener('click', async e => {
  const k = e.target.dataset.k; if (!k) return;
  $('#lockErr').hidden = true;
  if (k === 'Clear') { lock.buf = ''; drawDots(); return; }
  if (k === 'OK') { await submitPin(); return; }
  if (lock.buf.length < 6) { lock.buf += k; drawDots(); if (lock.buf.length === 6) await submitPin(); }
});
async function submitPin() {
  const pin = lock.buf;
  if (pin.length < 4) { err('Use at least 4 digits'); return; }
  if (lock.mode === 'set') { lock.first = pin; lock.mode = 'confirm'; lock.buf = ''; drawDots(); $('#lockMsg').textContent = 'Enter the same PIN again'; return; }
  if (lock.mode === 'confirm') {
    if (pin !== lock.first) { lock.mode = 'set'; lock.first = ''; lock.buf = ''; drawDots(); $('#lockMsg').textContent = 'Create a PIN (4 to 6 digits)'; err('PINs did not match, start again'); return; }
    $('#lockMsg').textContent = 'Setting up…'; await setPin(pin); unlocked(); return;
  }
  if (lock.mode === 'enter') {
    $('#lockMsg').textContent = 'Checking…';
    if (await tryPin(pin)) unlocked(); else { lock.buf = ''; drawDots(); $('#lockMsg').textContent = 'Enter your PIN'; err('Wrong PIN'); }
  }
  function err(m) { $('#lockErr').textContent = m; $('#lockErr').hidden = false; lock.buf = ''; drawDots(); }
}
$('#btnForgot').onclick = async () => {
  const ok = await confirmSheet('Forgot PIN?', 'You can set a new PIN, but any <b>saved card numbers will be erased</b> (they can only be unlocked with the old PIN). Orders, customers and items are kept.', 'Erase cards & reset PIN', true);
  if (!ok) return;
  ORDERS.forEach(o => { o.card = null; }); saveOrders();
  PINREC = null; LS.del('fo.pin'); showLock();
};
function unlocked() { lock.buf = ''; drawDots(); renderHome(); show('home'); }
let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); if (cur) persistCur(); }
  else if (hiddenAt && KEY && Date.now() - hiddenAt > 5 * 60 * 1000) { cur = null; showLock(); }
});
window.addEventListener('pagehide', () => { if (cur) persistCur(); });

/* ---------- navigation ---------- */
function show(id) { $$('.screen').forEach(s => s.hidden = s.id !== id); window.scrollTo(0, 0); }

/* ---------- order model ---------- */
function newOrder() {
  return {
    id: uid(), createdAt: Date.now(), updatedAt: Date.now(), status: 'draft', items: [],
    info: { customerType: SETTINGS.customerType, orderType: SETTINGS.orderType, event: SETTINGS.event, marketing: 'None', ror: 'No', orderDate: today(), notes: '' },
    bill: { first: '', last: '', company: '', addr1: '', addr2: '', city: '', state: 'CA', zip: '', phone: '', alt: '', email: '', lang: 'English' },
    shipReq: true, shipSame: true,
    ship: { first: '', last: '', company: '', addr1: '', addr2: '', city: '', state: 'CA', zip: '', phone: '', alt: '' },
    pay: { shipMethod: 'ground', method: 'Credit/Debit Card', taxable: true, taxRate: SETTINGS.taxRate, taxSource: 'default', taxJuris: '', plan: 1, special: '', gift: '', notPresent: false, summarized: false, emailReceipt: false },
    card: null, cardLast4: '', sig: null, enteredAt: null
  };
}
function shipCost(o, methodId, sub) {
  if (!o.shipReq) return 0;
  const tiers = isGiftOrder(o) ? PPSI_TIERS : EXPRESS_TIERS;
  const t = tiers.find(x => sub <= x.max) || tiers[tiers.length - 1];
  if (methodId === 'ground') return isGiftOrder(o) ? t.ground : 0;
  return t[methodId] || 0;
}
function plansFor(o, sub) { return PAY_PLANS.filter(p => (!p.giftOnly || isGiftOrder(o)) && sub >= p.min); }
function totals(o) {
  const paid = o.items.filter(i => !i.free), free = o.items.filter(i => i.free);
  const sub = r2(paid.reduce((a, i) => a + (+i.qty || 0) * (+i.price || 0), 0));
  const bonusValue = r2(free.reduce((a, i) => a + (+i.qty || 0) * (+i.retail || +i.price || 0), 0));
  const bonusAllowed = r2(sub * bonusLimit() / 100); const bonusOver = bonusValue > bonusAllowed + 0.005;
  const value = r2(o.items.reduce((a, i) => a + (+i.qty || 0) * (+i.wps || +i.retail || +i.price || 0), 0));
  const cpoGross = r2(paid.reduce((a, i) => a + lineCpo(i), 0));
  const bonusPts = free.reduce((a, i) => a + (+i.qty || 0) * (+i.pts || 0), 0);
  const cpo = r2(cpoGross - bonusPts);
  const sc = shipCost(o, o.pay.shipMethod, sub);
  const plan = PAY_PLANS.find(p => p.n === +o.pay.plan) || PAY_PLANS[0];
  const fee = plan.n > 1 ? plan.fee : 0;
  const before = r2(sub + sc + fee);
  const tax = o.pay.taxable ? r2(before * (+o.pay.taxRate || 0) / 100) : 0;
  const total = r2(before + tax);
  const n = plan.n; const each = r2(total / n);
  const pays = Array.from({ length: n }, () => each); pays[n - 1] = r2(total - each * (n - 1));
  const sm = SHIP_METHODS.find(x => x.id === o.pay.shipMethod) || SHIP_METHODS[0];
  return { sub, bonusValue, bonusAllowed, bonusOver, value, cpo, cpoGross, bonusPts, shipCost: sc, shipLabel: sm.label, fee, before, tax, total, n, pays };
}
function custName(o) { const n = (o.bill.first + ' ' + o.bill.last).trim(); return n || '(no name yet)'; }
function itemLabel(i) {
  const d = i.b ? lineDesc(i) : Object.values(i.opts || {}).filter(Boolean).join(', ');
  return [i.name, d, i.free ? 'BONUS (free)' : '', i.note ? '“' + i.note + '”' : ''].filter(Boolean).join(' — ');
}

/* ---------- home ---------- */
let homeFilter = 'all';
$('#homeTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; homeFilter = b.dataset.f; $$('#homeTabs button').forEach(x => x.classList.toggle('on', x === b)); renderHome(); });
function renderHome() {
  const list = ORDERS.filter(o => homeFilter === 'all' || o.status === homeFilter).sort((a, b) => b.updatedAt - a.updatedAt);
  $('#homeEmpty').hidden = list.length > 0;
  const lbl = { draft: 'In progress', ready: 'To enter', entered: 'Entered' };
  $('#orderList').innerHTML = list.map(o => {
    const t = totals(o);
    return `<div class="card" data-id="${o.id}">
      <div class="row1"><div class="name">${h(custName(o))}</div><div class="amt">${money(t.total)}</div><button class="btn small ${o.status === 'entered' ? '' : 'primary'}" data-edit="${o.id}">${o.status === 'entered' ? 'View' : 'Edit'}</button></div>
      <div class="sub"><span class="badge ${o.status}">${lbl[o.status]}</span><span>${fmtDate(o.info.orderDate)}</span><span>· ${o.items.length} item${o.items.length === 1 ? '' : 's'}</span><span class="cpo">· CPO ${money(t.cpo)}</span>${isGiftOrder(o) ? `<span>· ${h(o.info.orderType)}</span>` : ''}${o.cardLast4 ? `<span>· card ····${h(o.cardLast4)}${o.card ? '' : ' (wiped)'}</span>` : ''}${o.info.event ? `<span>· ${h(o.info.event)}</span>` : ''}</div>
    </div>`;
  }).join('');
  const pending = ORDERS.filter(o => o.status === 'ready').length;
  $('#btnShareAll').textContent = pending ? `Email pending (${pending})` : 'Email pending';
}
$('#orderList').addEventListener('click', e => {
  const b = e.target.closest('button[data-edit]');
  if (b) { const o = ORDERS.find(x => x.id === b.dataset.edit); if (!o) return; if (o.status === 'entered') openDetail(o.id); else openEditor(o, false); return; }
  const c = e.target.closest('.card'); if (c) openDetail(c.dataset.id); });
$('#btnNew').onclick = () => { openEditor(newOrder(), true); };
$('#btnSettings').onclick = () => { renderSettings(); show('settings'); };
$('#btnShareAll').onclick = () => {
  const list = ORDERS.filter(o => o.status === 'ready');
  if (!list.length) { toast('No orders marked "To enter" yet'); return; }
  shareText('Pending Cutco orders (' + list.length + ')', list.map(orderText).join('\n\n==========\n\n'));
};

/* ---------- editor ---------- */
let cur = null, curCard = null, step = 0, isNew = false, itemQuery = '', itemCat = 'sets';
async function openEditor(o, fresh) {
  cur = o; isNew = !!fresh; step = 0; itemQuery = '';
  curCard = { number: '', expM: '', expY: '', cvv: '' };
  if (o.card && KEY) { try { curCard = await CR.dec(KEY, o.card); } catch (e) { toast('Could not read saved card (wrong PIN?)'); } }
  $('#edTitle').textContent = fresh ? 'New Order' : custName(o);
  renderStep(); show('editor');
}
function persistCur() {
  if (!cur) return;
  cur.updatedAt = Date.now();
  const idx = ORDERS.findIndex(o => o.id === cur.id);
  if (idx < 0) ORDERS.push(cur); else ORDERS[idx] = cur;
  saveOrders();
}
async function saveCard() {
  if (!cur) return;
  const num = (curCard.number || '').replace(/\D/g, '');
  if (num.length >= 4 || curCard.expM || curCard.expY || curCard.cvv) {
    cur.cardLast4 = num.slice(-4);
    if (KEY) cur.card = await CR.enc(KEY, { number: num, expM: curCard.expM, expY: curCard.expY, cvv: (curCard.cvv || '').replace(/\D/g, '').slice(0, 4) });
  } else { cur.card = null; cur.cardLast4 = ''; }
}
async function closeEditor(goDetail) {
  if (!cur) { renderHome(); show('home'); return; }
  if (isNew && !cur.items.length && !cur.bill.first && !cur.bill.last) { ORDERS = ORDERS.filter(o => o.id !== cur.id); saveOrders(); cur = null; curCard = null; renderHome(); show('home'); return; }
  await saveCard(); persistCur();
  const id = cur.id; cur = null; curCard = null;
  renderHome();
  if (goDetail) openDetail(id); else show('home');
}
$('#btnEdBack').onclick = () => closeEditor(false);
$('#btnEdClose').onclick = () => closeEditor(!!cur && (!isNew || cur.items.length > 0 || cur.bill.first));
$('#steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { step = +b.dataset.s; renderStep(); } });
$('#btnPrev').onclick = () => { if (step > 0) { step--; renderStep(); } };
$('#btnNext').onclick = async () => {
  if (step < 3) { step++; renderStep(); return; }
  // Finish: mark ready
  if (!cur.items.length) { toast('Add at least one item'); step = 0; renderStep(); return; }
  if (!cur.bill.first || !cur.bill.last) { toast('Customer first and last name are needed'); step = 1; renderStep(); return; }
  cur.status = cur.status === 'entered' ? 'entered' : 'ready';
  await closeEditor(true); toast('Saved. Ready to enter in Cutco.');
};
function renderStep() {
  $$('#steps button').forEach((b, i) => { b.classList.toggle('on', i === step); b.classList.toggle('done', i < step); });
  $('#btnPrev').style.visibility = step === 0 ? 'hidden' : 'visible';
  $('#btnNext').textContent = step === 3 ? (cur.status === 'entered' ? 'Save' : 'Mark ready') : 'Next';
  const body = $('#edBody');
  body.innerHTML = [renderItems, renderCustomer, renderPayment, renderReview][step]();
  body.scrollTop = 0;
  updateTotal();
  if (step === 3) initSig();
  if (step >= 2) applyTax(cur).then(() => { if (cur && step >= 2) { renderTaxBox(); updateTotal(); } });
  if (step === 0) { const s = $('#itemSearch'); if (s && itemQuery) s.focus(); }
}
function updateTotal() {
  const t = totals(cur); $('#edTotal').textContent = cur.items.length ? 'Total ' + money(t.total) : '';
  const n = cur.items.reduce((s, i) => s + (+i.qty || 0), 0); $('#cartBadge').textContent = n || ''; $('#cartBadge').hidden = !n;
  $('#cpoBand').innerHTML = `<div><small>Value</small>${money(t.value)}</div><div><small>Customer Pays</small>${money(t.sub)}</div><div class="cpo"><small>CPO</small>${money(t.cpo)}</div>${t.bonusValue ? `<div class="cpo ${t.bonusOver ? 'over' : ''}"><small>Bonus</small>${money(t.bonusValue)}<small>of ${money(t.bonusAllowed)}</small></div>` : ''}`;
}
function repriceLines() { cur.items.forEach(l => { if (l.manual || !l.b) return; const it = allProducts().find(p => p.key === l.key); if (it) l.price = unitPrice(it, cur); }); }

/* --- step 1: items (photo grid → options sheet → cart) --- */
const FAM_OF = (() => { const m = {}; (typeof FAMILIES !== 'undefined' ? FAMILIES : []).forEach(f => Object.values(f.variants).forEach(v => { m[typeof v === 'string' ? v : v.key] = f; })); return m; })();
function tilesFor(list) {
  const out = [], seen = new Set();
  list.forEach(p => { const f = FAM_OF[p.key]; if (f) { if (!seen.has(f)) { seen.add(f); out.push({ fam: f, p }); } } else out.push({ p }); });
  return out;
}
function famPrices(f) { const P = allProducts(); return Object.values(f.variants).map(v => P.find(x => x.key === (typeof v === 'string' ? v : v.key))).filter(Boolean).map(p => unitPrice(p, cur)); }
function renderItems() {
  const prods = allProducts();
  const gift = isGiftOrder(cur);
  const q = itemQuery.trim().toLowerCase();
  let list = q ? prods.filter(p => (p.name + ' ' + p.b + ' ' + (FAM_OF[p.key] ? FAM_OF[p.key].name : '')).toLowerCase().includes(q)).slice(0, 80) : prods.filter(p => p.c === itemCat);
  const cats = CATEGORIES.filter(c => (c.id !== 'custom' || CUSTOM_ITEMS.length) && (c.id !== 'services' || gift));
  const t = totals(cur);
  const cartbar = cur.items.length ? `<button class="cartbar" id="btnCartBar"><span>${cur.items.reduce((n, i) => n + (+i.qty || 0), 0)} item${cur.items.length === 1 && cur.items[0].qty === 1 ? '' : 's'} in this order · <b>${money(t.sub)}</b></span><span class="lnk">View cart ›</span></button>` : '';
  const tiles = tilesFor(list);
  return `${cartbar}
  ${gift ? `<p class="note" style="margin:0 0 6px"><b>${h(cur.info.orderType)} order:</b> business-gift prices are used where Cutco publishes them.</p>` : ''}
  <div class="search"><input id="itemSearch" placeholder="Search name or item #" value="${h(itemQuery)}" autocomplete="off"><button class="btn small" id="btnCustomItem">+ Custom</button></div>
  ${q ? '' : `<div class="chips">${cats.map(c => `<button data-cat="${c.id}" class="${c.id === itemCat ? 'on' : ''}">${h(c.name)}</button>`).join('')}</div>`}
  ${tiles.length ? `<div class="pgrid">` + tiles.map(tl => {
    if (tl.fam) { const f = tl.fam; const ps = famPrices(f); const lo = Math.min(...ps), hi = Math.max(...ps); const fi = FAMILIES.indexOf(f);
      return `<div class="ptile" data-open="fam:${fi}"><div class="pimg ${hasImg(f.img) ? '' : 'none'}" style="${spriteStyle(f.img, 140)}"></div><div class="pn">${h(f.name)}</div><div class="pi">${f.dims.map(d => h(d.label)).join(' · ')}</div><div class="pp">${lo === hi ? money(lo) : money(lo) + ' – ' + money(hi)}</div><button class="btn small addbtn">Choose options</button></div>`; }
    const p = tl.p; const up = unitPrice(p, cur);
    return `<div class="ptile" data-open="key:${h(p.key)}"><div class="pimg ${hasImg(p.key) ? '' : 'none'}" style="${spriteStyle(p.key, 140)}"></div><div class="pn">${h(p.name)}</div><div class="pi">#${h(p.b)}${p.col ? ' · ' + p.col.split('').map(c => COLOR_NAMES[c]).join('/') : ''}${p.na ? '<br><span style="color:var(--red)">not in Cutco app, use Special Instructions</span>' : ''}<span class="cpo"><br>CPO ${money(p.cpo)} · ${p.pts} pts${p.e ? ' <i title="estimated">(est.)</i>' : ''}</span></div><div class="pp">${money(up)}${up !== p.p ? `<small class="was">retail ${money(p.p)}</small>` : ''}</div><button class="btn small addbtn">${p.col || p.out || p.ch || (p.o || []).length ? 'Choose options' : 'Add to Order'}</button></div>`;
  }).join('') + `</div>` : `<p class="empty">Nothing found.<br>Use <b>+ Custom</b> to add an item that is not in the list.</p>`}`;
}
function newLine(p, st) {
  return { id: uid(), key: p.key, b: p.b, sfx: p.sfx, col: p.col, out: p.out, ch: p.ch, o: p.o || [], gc: p.gc, name: p.name, qty: st.qty, price: st.price != null ? st.price : unitPrice(p, cur), retail: p.p, wps: p.wps || 0, cpo: p.cpo, pts: p.pts, opts: Object.assign({}, st.opts), note: st.note || '', free: !!st.free, manual: st.price != null };
}
/* Bonus limit: retail value of bonus items may not exceed bonusLimit% of what the customer pays. */
function bonusMath(p, st, line) {
  const others = cur.items.filter(l => l !== line);
  const paid = r2(others.filter(l => !l.free).reduce((a, l) => a + (+l.qty || 0) * (+l.price || 0), 0));
  const bonus = r2(others.filter(l => l.free).reduce((a, l) => a + (+l.qty || 0) * (+l.retail || +l.price || 0), 0));
  const mine = r2((+st.qty || 0) * (+p.p || 0));
  return { paid, bonus, mine, allowed: r2(paid * bonusLimit() / 100) };
}
function bonusFits(p, st, line) { const m = bonusMath(p, st, line); return m.bonus + m.mine <= m.allowed + 0.005; }
function bonusNote(p, st, line, over) {
  const m = bonusMath(p, st, line); const lim = bonusLimit();
  if (!lim) return 'Bonus limit is 0% (Settings), so no bonus items are allowed.';
  const room = r2(m.allowed - m.bonus);
  return (over ? `Over the bonus limit. ` : '') + `Bonus limit ${lim}% of ${money(m.paid)} paid = ${money(m.allowed)}` + (m.bonus ? ` (${money(m.bonus)} already used)` : '') + `. Room left: ${money(Math.max(0, room))}; this item is ${money(m.mine)}.`;
}
/* Options sheet: spec = { fam } | { key } | { line } (edit). */
function optionsSheet(spec) {
  const P = allProducts();
  let fam = spec.fam || (spec.line ? FAM_OF[spec.line.key] : (spec.key ? FAM_OF[spec.key] : null));
  if (spec.key && fam && !spec.fam) fam = null; // direct key tap on a family member: keep it simple, no dims
  const st = { dims: [], opts: {}, qty: 1, price: null, free: false, note: '' };
  if (spec.line) { const l = spec.line; Object.assign(st, { opts: Object.assign({}, l.opts), qty: l.qty, price: l.manual ? l.price : null, free: !!l.free, note: l.note || '' });
    if (fam) { const ent = Object.entries(fam.variants).find(([k, v]) => (typeof v === 'string' ? v : v.key) === l.key && (typeof v === 'string' || v.out === l.opts.out)); st.dims = ent ? ent[0].split('|') : fam.dims.map(d => d.choices[0]); } }
  else if (fam) st.dims = fam.dims.map(d => d.choices[0]);
  function resolve() {
    if (fam) { const v = fam.variants[st.dims.join('|')]; const key = typeof v === 'string' ? v : v.key; const p = P.find(x => x.key === key); if (p && typeof v !== 'string') st.opts.out = v.out; return p; }
    return P.find(x => x.key === (spec.key || spec.line.key));
  }
  function render() {
    const p = resolve(); if (!p) { closeSheet(); toast('Item not found'); return; }
    if (p.col && !(p.col.includes(st.opts.color || ''))) st.opts.color = p.col[0];
    if (p.out && !p.out.includes(st.opts.out)) st.opts.out = p.out[0];
    (p.o || []).forEach(g => { if (!st.opts[g]) st.opts[g] = OPTION_GROUPS[g].choices[0]; });
    const up = st.price != null ? st.price : unitPrice(p, cur);
    const sel = (attr, label, choices, val) => `<div class="field"><label>${h(label)}</label><select data-o="${attr}">${choices.map(([v, t]) => `<option value="${h(v)}" ${String(val) === String(v) ? 'selected' : ''}>${h(t)}</option>`).join('')}</select></div>`;
    let html = `<div class="sheethead"><div class="pimg ${hasImg(p.key) ? '' : 'none'}" style="${spriteStyle(p.key, 110)}"></div><div><h3>${h(fam ? fam.name : p.name)}</h3><div class="note" style="margin:0">#<b id="shNo"></b><span class="cpo"> · CPO ${money(p.cpo)} · ${p.pts} pts${p.e ? ' (est.)' : ''}</span>${p.wps ? '<br>Value ' + money(p.wps) : ''}</div></div></div>`;
    if (fam) html += fam.dims.map((d, i) => sel('dim' + i, d.label, d.choices.map(c => [c, c]), st.dims[i])).join('');
    if (fam) html += `<p class="note" style="margin:-2px 0 8px">${h(p.name)}</p>`;
    if (p.col) html += sel('color', 'Handle Color', p.col.split('').map(c => [c, COLOR_NAMES[c]]), st.opts.color);
    if (p.out && !fam) html += sel('out', 'Handle', p.out.map(c => [c, OUTDOOR_COLORS[c]]), st.opts.out);
    if (p.ch) html += sel('cherry', 'Block Finish', [['', 'Honey'], ['1', 'Cherry']], st.opts.cherry ? '1' : '');
    (p.o || []).forEach(g => { html += sel(g, OPTION_GROUPS[g].label, OPTION_GROUPS[g].choices.map(c => [c, c]), st.opts[g]); });
    html += `<div class="shrow"><div class="qty"><button data-q="-1">−</button><span id="shQty">${st.qty}</span><button data-q="1">+</button></div>
      <div class="field" style="flex:1;margin:0"><label>Unit price</label><input type="number" inputmode="decimal" step="0.01" id="shPrice" value="${up}"></div></div>
      ${up !== p.p ? `<p class="note">Retail ${money(p.p)}${isGiftOrder(cur) && p.g != null ? ' · gift price ' + money(p.g) : ''}</p>` : ''}
      <label class="check"><input type="checkbox" id="shFree" ${st.free ? 'checked' : ''}> <span>Bonus<span class="cpo"> — takes ${p.pts} pts off CPO</span></span></label>
      <p class="note cpo" style="margin:-4px 0 8px">${bonusNote(p, st, spec.line)}</p>
      <div class="field"><label>Note</label><input id="shNote" value="${h(st.note)}" placeholder="Engraving, special request…"></div>
      <div class="acts">${spec.line ? '<button class="btn danger" id="shRemove">Remove</button>' : ''}<button class="btn" id="shCancel">Cancel</button><button class="btn primary" id="shOk">${spec.line ? 'Save' : 'Add to Order'} · ${money((st.free ? 0 : up) * st.qty)}</button></div>`;
    openSheet(html);
    const fake = { b: p.b, sfx: p.sfx, col: p.col, out: p.out, ch: p.ch, opts: st.opts }; $('#shNo').textContent = itemNo(fake);
    const sh = $('#sheet');
    sh.onchange = e => { const t = e.target; if (!t.dataset.o) return; const k = t.dataset.o;
      if (k.startsWith('dim')) st.dims[+k.slice(3)] = t.value; else if (k === 'cherry') st.opts.cherry = !!t.value; else st.opts[k] = t.value; render(); };
    sh.oninput = e => { if (e.target.id === 'shPrice') { st.price = e.target.value === '' ? null : +e.target.value; $('#shOk').textContent = (spec.line ? 'Save' : 'Add to Order') + ' · ' + money((st.free ? 0 : (st.price != null ? st.price : unitPrice(p, cur))) * st.qty); } if (e.target.id === 'shNote') st.note = e.target.value; if (e.target.id === 'shFree') { if (e.target.checked && !bonusFits(p, st, spec.line)) { e.target.checked = false; toast(bonusNote(p, st, spec.line, true)); return; } st.free = e.target.checked; render(); } };
    sh.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.q) { st.qty = Math.max(1, st.qty + (+b.dataset.q)); render(); return; }
      if (b.id === 'shCancel') { closeSheet(); return; }
      if (b.id === 'shRemove') { cur.items = cur.items.filter(l => l !== spec.line); closeSheet(); afterCartChange(); toast('Removed'); return; }
      if (b.id === 'shOk') {
        if (st.free && !bonusFits(p, st, spec.line)) { toast(bonusNote(p, st, spec.line, true)); return; }
        if (st.price != null && st.price === unitPrice(p, cur)) st.price = null;
        if (spec.line) { const l = spec.line; Object.assign(l, newLine(p, st), { id: l.id }); }
        else cur.items.push(newLine(p, st));
        closeSheet(); afterCartChange(); toast(spec.line ? 'Saved' : 'Added ' + p.name); } };
  }
  render();
}
function afterCartChange() { persistCur(); if (!$('#cart').hidden) renderCart(); else if (!$('#editor').hidden) { renderStep(); } updateTotal(); }
function addItem(key) { optionsSheet({ key }); }
function customItemSheet() {
  openSheet(`<h3>Custom item</h3>
    <div class="field"><label>Name</label><input id="ciName" placeholder="Item name"></div>
    <div class="field"><label>Item #</label><input id="ciNum" placeholder="optional"></div>
    <div class="field"><label>Price</label><input id="ciPrice" type="number" inputmode="decimal" step="0.01" placeholder="0.00"></div>
    <div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>CPO</label><input id="ciCpo" type="number" inputmode="decimal" placeholder="optional"></div><div class="field" style="flex:1"><label>Points</label><input id="ciPts" type="number" inputmode="numeric" placeholder="optional"></div></div>
    <label class="check"><input type="checkbox" id="ciKeep" checked> Keep in my catalog for next time</label>
    <div class="acts"><button class="btn" id="ciCancel">Cancel</button><button class="btn primary" id="ciAdd">Add to order</button></div>`);
  $('#ciCancel').onclick = closeSheet;
  $('#ciAdd').onclick = () => {
    const name = $('#ciName').value.trim(); const price = +$('#ciPrice').value || 0; let n = $('#ciNum').value.trim() || ('X' + uid().slice(-5).toUpperCase());
    const cpo = +$('#ciCpo').value || 0, pts = +$('#ciPts').value || 0;
    if (!name) { toast('Give it a name'); return; }
    if ($('#ciKeep').checked && !allProducts().find(p => p.key === n)) { CUSTOM_ITEMS.push({ b: n, name, p: price, cpo, pts, c: 'custom' }); LS.write('fo.custom', CUSTOM_ITEMS); }
    cur.items.push({ id: uid(), key: n, b: n, o: [], name, qty: 1, price, retail: price, cpo, pts, opts: {}, note: '', free: false, manual: true });
    closeSheet(); afterCartChange();
  };
  setTimeout(() => $('#ciName').focus(), 50);
}

/* --- cart screen --- */
function showCart() { renderCart(); show('cart'); }
function renderCart() {
  const t = totals(cur);
  $('#cartBody').innerHTML = (cur.items.length ? cur.items.map(i => { const q = +i.qty || 0; return `<div class="cline ${i.free ? 'free' : ''}" data-line="${i.id}">
      <div class="limg ${hasImg(i.key) ? '' : 'none'}" style="${spriteStyle(i.key, 56)}"></div>
      <div class="ci"><div class="cn">${h(i.name)}</div><div class="cd">#${h(itemNo(i))}${i.b ? (lineDesc(i) ? ' · ' + h(lineDesc(i)) : '') : ''}${i.note ? ' · “' + h(i.note) + '”' : ''}<br>${q} × ${i.free ? 'BONUS' : money(i.price)}<span class="cpo"> · CPO ${money(lineCpo(i))}${i.free ? ' · −' + q * i.pts + ' pts' : ''}</span></div></div>
      <div class="lp">${i.free ? '$0.00' : money(q * i.price)}</div><div class="chev">›</div></div>`; }).join('')
    : '<p class="empty">Nothing in the cart yet.</p>')
    + dealHtml()
    + `<div class="box cpo" style="margin-top:12px"><div class="tot"><span>Value</span><span class="money">${money(t.value)}</span></div><div class="tot"><span>Customer Pays</span><span class="money">${money(t.sub)}</span></div>${t.bonusValue ? `<div class="tot cpo ${t.bonusOver ? 'overtxt' : ''}"><span>Bonus items (limit ${bonusLimit()}% = ${money(t.bonusAllowed)})</span><span>${money(t.bonusValue)}</span></div>` : ''}${t.bonusOver ? `<p class="warn cpo" style="margin:6px 0">Bonus items are over the ${bonusLimit()}% limit. Remove a bonus item or add paid items.</p>` : ''}${t.bonusPts ? `<div class="tot cpo"><span>Bonus points given</span><span>${t.bonusPts} pts</span></div>` : ''}<div class="tot grand cpo"><span>CPO</span><span class="money">${money(t.cpo)}</span></div></div>
    <p class="note">Tap an item to change its options, quantity, price or note, or to remove it.</p>`;
  $('#cartCount').textContent = cur.items.length ? `(${cur.items.reduce((n, i) => n + (+i.qty || 0), 0)})` : '';
}
/* Customer-facing summary on the cart page: value, deal, savings and payment choices. */
function dealHtml() {
  if (!cur.items.length) return '';
  const t = totals(cur); const save = r2(t.value - t.sub);
  const plans = plansFor(cur, t.sub);
  if (!plans.find(p => p.n === +cur.pay.plan)) cur.pay.plan = 1;
  const rows = plans.map(p => { const tt = totals(Object.assign({}, cur, { pay: Object.assign({}, cur.pay, { plan: p.n }) })); return `<button class="plan ${+cur.pay.plan === p.n ? 'on' : ''}" data-plan="${p.n}"><b>${p.n === 1 ? 'Pay in full' : p.n + ' payments'}</b><span class="amt">${money(tt.pays[0])}${p.n > 1 ? ' each' : ''}</span><small>${p.n > 1 && p.fee ? money(p.fee) + ' admin fee incl. · ' : ''}total ${money(tt.total)}</small></button>`; }).join('');
  return `<div class="box deal"><div class="bh">Your deal</div>
    <div class="tot"><span>Value</span><span class="money">${money(t.value)}</span></div>
    <div class="tot"><span>Your price</span><span class="money">${money(t.sub)}</span></div>
    ${save > 0 ? `<div class="tot save"><span>You save</span><span>${money(save)}</span></div>` : ''}
    <div class="planhd">Payment options</div>
    <div class="plans2">${rows}</div>
    <p class="note" style="margin:6px 0 0">Per-payment amounts include ${cur.shipReq && t.shipCost ? 'shipping and ' : ''}${cur.pay.taxable ? 'estimated sales tax (' + cur.pay.taxRate + '%)' : 'no sales tax'}.${PAY_PLANS.some(p => !plans.includes(p) && (!p.giftOnly || isGiftOrder(cur))) ? ' More payment plans unlock at higher totals.' : ''}</p></div>`;
}
$('#cartBody').addEventListener('click', e => {
  const pb = e.target.closest('button[data-plan]'); if (pb) { cur.pay.plan = +pb.dataset.plan; persistCur(); renderCart(); return; }
  const c = e.target.closest('.cline'); if (!c) return; const l = cur.items.find(i => i.id === c.dataset.line); if (l) optionsSheet({ line: l }); });
$('#btnCartBack').onclick = () => { show('editor'); renderStep(); };
$('#btnCartMore').onclick = () => { step = 0; show('editor'); renderStep(); };
$('#btnCartNext').onclick = () => { step = 1; show('editor'); renderStep(); };
$('#btnCart').onclick = showCart;
$('#btnEye').onclick = () => { SETTINGS.hideCpo = !SETTINGS.hideCpo; saveSettings(); applyCustomerView(); toast(SETTINGS.hideCpo ? 'Customer view: CPO hidden' : 'CPO shown'); };

/* --- step 2: customer --- */
const F = (label, path, opt = {}) => {
  const v = get(cur, path); const type = opt.type || 'text';
  if (opt.select) return `<div class="field"><label>${label}</label><select data-k="${path}">${opt.select.map(s => `<option value="${h(s)}" ${s === v ? 'selected' : ''}>${h(s || '—')}</option>`).join('')}</select></div>`;
  if (opt.area) return `<div class="field"><label>${label}</label><textarea data-k="${path}" placeholder="${h(opt.ph || '')}">${h(v)}</textarea></div>`;
  return `<div class="field ${opt.req && !v ? 'err' : ''}"><label>${label}</label><input type="${type}" data-k="${path}" value="${h(v)}" placeholder="${h(opt.ph || (opt.req ? '' : 'optional'))}" ${opt.im ? `inputmode="${opt.im}"` : ''} autocomplete="off" autocapitalize="${opt.cap || 'words'}"></div>`;
};
const SEG = (path, choices, labels) => `<div class="seg">${choices.map((c, i) => `<button data-seg="${path}" data-val="${h(c)}" class="${String(get(cur, path)) === String(c) ? 'on' : ''}">${labels ? labels[i] : h(c)}</button>`).join('')}</div>`;
const YN = (label, path) => `<div class="segrow"><div class="lbl">${label}</div>${SEG(path, [true, false], ['Yes', 'No'])}</div>`;
function addressFields(pre, withEmail) {
  return F('First Name', pre + '.first', { req: true }) + F('Last Name', pre + '.last', { req: true }) + F('Company', pre + '.company') +
    F('Address 1', pre + '.addr1', { ph: 'Street address' }) + F('Address 2', pre + '.addr2') + F('City', pre + '.city') +
    F('State', pre + '.state', { select: [''].concat(US_STATES) }) + F('Zip Code', pre + '.zip', { im: 'numeric', ph: 'xxxxx' }) +
    F('Phone', pre + '.phone', { type: 'tel', ph: 'xxx-xxx-xxxx' }) + F('Alt. Phone', pre + '.alt', { type: 'tel' }) +
    (withEmail ? F('Email', pre + '.email', { type: 'email', cap: 'none' }) : '');
}
function renderCustomer() {
  return `<h2 class="sec">Order information</h2>
    ${F('Event', 'info.event', { ph: 'e.g. 00095706-Santa Cruz County Fair' })}
    ${F('Customer Type', 'info.customerType', { select: CUSTOMER_TYPES })}
    ${F('Order Type', 'info.orderType', { select: ORDER_TYPES })}
    ${F('Marketing', 'info.marketing', { ph: 'None' })}
    ${F('Order Date', 'info.orderDate', { type: 'date' })}
    <h2 class="sec">Billing information</h2>
    ${addressFields('bill', true)}
    <div class="segrow"><div class="lbl">Language</div>${SEG('bill.lang', ['English', 'Spanish'])}</div>
    <h2 class="sec">Shipping information</h2>
    ${YN('Is shipping required?', 'shipReq')}
    ${cur.shipReq ? YN('Shipping same as billing?', 'shipSame') : ''}
    ${cur.shipReq && !cur.shipSame ? addressFields('ship', false) : ''}`;
}

/* --- step 3: payment --- */
function renderPayment() {
  const t = totals(cur);
  const isCard = cur.pay.method === 'Credit/Debit Card';
  const gift = isGiftOrder(cur);
  const plans = plansFor(cur, t.sub);
  if (!plans.find(p => p.n === +cur.pay.plan)) cur.pay.plan = 1;
  return `<h2 class="sec">Shipping method</h2>
    ${cur.shipReq ? SEG('pay.shipMethod', SHIP_METHODS.map(x => x.id), SHIP_METHODS.map(x => { const c = shipCost(cur, x.id, t.sub); return `${x.label}<small>${c ? money(c) : 'Included'}</small>`; })) + (gift ? '<p class="note">Business / Realtor orders use the P.P.S.&amp;I. shipping table.</p>' : '<p class="note">Express charges are estimated from the product subtotal.</p>') : '<p class="note">No shipping on this order.</p>'}
    <h2 class="sec">Payment method</h2>
    ${SEG('pay.method', PAY_METHODS)}
    <h2 class="sec">Sales tax</h2>
    ${SEG('pay.taxable', [true, false], ['Taxable', 'Tax Exempt'])}
    <div id="taxBox">${cur.pay.taxable ? taxBoxHtml() : ''}</div>
    <h2 class="sec">Number of payments</h2>
    <div class="seg plans">${plans.map(p => { const tt = totals(Object.assign({}, cur, { pay: Object.assign({}, cur.pay, { plan: p.n }) })); return `<button data-seg="pay.plan" data-val="${p.n}" class="${+cur.pay.plan === p.n ? 'on' : ''}"><b>${p.n} payment${p.n > 1 ? 's' : ''} of ${money(tt.pays[0])}</b><small>${p.fee && p.n > 1 ? money(p.fee) + ' admin fee incl.' : 'No admin fee'}</small></button>`; }).join('')}</div>
    ${PAY_PLANS.filter(p => !plans.includes(p) && (!p.giftOnly || gift)).length ? `<p class="note">More payment plans unlock at higher product totals ($70 for 2, $200 for 3, $400 for 5${gift ? ', $600 for 6' : ''}).</p>` : ''}
    ${isCard ? `<h2 class="sec">Card details</h2>
    <div class="warn">Card number, expiration and CVV are stored encrypted on this phone only. Erased automatically when you mark the order as entered in Cutco.</div>
    <div class="field"><label>Card Number</label><input type="text" inputmode="numeric" autocomplete="off" id="cardNum" value="${h(fmtCard(curCard.number))}" placeholder="•••• •••• •••• ••••"></div>
    <div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>Exp. Month</label><select id="cardM"><option value="">MM</option>${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => `<option ${curCard.expM === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="field" style="flex:1"><label>Exp. Year</label><select id="cardY"><option value="">YYYY</option>${Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + i)).map(y => `<option ${curCard.expY === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
    <div class="field"><label>CVV</label><input type="text" inputmode="numeric" autocomplete="off" id="cardCvv" maxlength="4" value="${h(curCard.cvv || '')}" placeholder="3 or 4 digits (optional)"></div>` : ''}
    <h2 class="sec">Instructions</h2>
    ${F('Special instr.', 'pay.special', { area: true, ph: 'Special instructions for Olean to process the order' })}
    ${F('Gift message', 'pay.gift', { area: true, ph: 'Gift message for the packing slip' })}
    ${F('My notes', 'info.notes', { area: true, ph: 'Anything to remember when entering this order' })}`;
}
function taxBoxHtml() {
  const a = taxAddress(cur); const src = cur.pay.taxSource || 'default';
  const srcLabel = { exact: '✓ Exact rate for this address', city: 'Estimate from the city table', county: 'Estimate from the county table', default: 'Default rate (no match)', other: 'Outside California', manual: 'Entered by hand' }[src] || '';
  const where = [a.city, a.state, a.zip].filter(Boolean).join(' ');
  return `<div class="field"><label>Tax rate %</label><input type="number" inputmode="decimal" step="0.001" data-k="pay.taxRate" data-manual value="${h(cur.pay.taxRate)}"></div>
    <p class="note" style="margin-top:-2px">${srcLabel}${cur.pay.taxJuris ? ' — ' + h(cur.pay.taxJuris) : ''}${where ? '<br>Ship-to: ' + h(where) : '<br>Enter the address first for an automatic rate.'}</p>
    <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn small" id="btnTaxExact">${navigator.onLine ? 'Look up exact rate' : 'Look up (needs signal)'}</button><button class="btn small" id="btnTaxEst">Use table estimate</button></div>`;
}
function renderTaxBox() { const b = $('#taxBox'); if (b && cur.pay.taxable) b.innerHTML = taxBoxHtml(); }
const fmtCard = s => (s || '').replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

/* --- step 4: review + signature --- */
function renderReview() {
  const t = totals(cur);
  return `${summaryHtml(cur, false)}
    <div class="box"><div class="bh">Authorization and signature</div>
    <label class="check"><input type="checkbox" data-k="pay.notPresent" ${cur.pay.notPresent ? 'checked' : ''}> Customer not present</label>
    <div class="sigwrap"><canvas id="sig" class="sigpad ${cur.sig ? 'has' : ''}"></canvas><button class="btn small sigclr" id="sigClear">Clear</button></div>
    <p class="note">Customer signs with a finger.</p>
    <label class="check"><input type="checkbox" data-k="pay.summarized" ${cur.pay.summarized ? 'checked' : ''}> Use summarized pricing on customer receipt</label>
    <label class="check"><input type="checkbox" data-k="pay.emailReceipt" ${cur.pay.emailReceipt ? 'checked' : ''}> Email a copy of the receipt to me</label></div>`;
}
function summaryHtml(o, withCopy) {
  const t = totals(o);
  const cp = (txt) => withCopy ? `<button class="copybtn" data-copy="${h(txt)}">Copy</button>` : '';
  const kv = (k, v, cls) => v ? `<div class="kv"><div class="k">${k}</div><div class="v ${cls || ''}">${h(v)}</div>${withCopy && !cls ? `<button class="copybtn" data-copy="${h(v)}">Copy</button>` : ''}</div>` : '';
  const addr = a => [a.company, a.addr1, a.addr2, [a.city, a.state].filter(Boolean).join(', ') + (a.zip ? ' ' + a.zip : '')].filter(x => x && x.trim()).join('\n');
  const addrBlock = (title, a, withEmail) => `<div class="box"><div class="bh">${title}<span class="spacer"></span>${cp([a.first + ' ' + a.last, addr(a), a.phone, a.alt, withEmail ? a.email : ''].filter(Boolean).join('\n'))}</div>
    ${kv('First Name', a.first)}${kv('Last Name', a.last)}${kv('Company', a.company)}${kv('Address 1', a.addr1)}${kv('Address 2', a.addr2)}${kv('City', a.city)}${kv('State', a.state)}${kv('Zip', a.zip)}${kv('Phone', a.phone)}${kv('Alt. Phone', a.alt)}${withEmail ? kv('Email', a.email) : ''}</div>`;
  return `<div class="box"><div class="bh">Order information</div>
      ${kv('Order Date', fmtDate(o.info.orderDate), 'x')}${kv('Event', o.info.event)}${kv('Customer Type', o.info.customerType, 'x')}${kv('Order Type', o.info.orderType + (isGiftOrder(o) ? ' (gift pricing)' : ''), 'x')}${kv('Marketing', o.info.marketing, 'x')}${kv('Language', o.bill.lang, 'x')}</div>
    ${addrBlock('Billing', o.bill, true)}
    ${o.shipReq ? (o.shipSame ? `<div class="box"><div class="bh">Shipping</div><div class="kv"><div class="v">Same as billing</div></div></div>` : addrBlock('Shipping', o.ship, false)) : `<div class="box"><div class="bh">Shipping</div><div class="kv"><div class="v">Not required</div></div></div>`}
    <div class="box"><div class="bh">Order items (${o.items.length})</div>
      ${o.items.map(i => `<div class="kv"><div class="k">${i.qty} × #${h(itemNo(i))}</div><div class="v">${h(itemLabel(i))}<br><span style="color:var(--orange);font-weight:600">${i.free ? 'BONUS' : money(i.qty * i.price)}</span>${i.qty > 1 && !i.free ? ` <small style="color:var(--muted)">(${money(i.price)} each)</small>` : ''} <small class="cpo" style="color:var(--muted)">· CPO ${money(lineCpo(i))}${i.free ? ' · −' + (i.qty * i.pts) + ' pts' : ''}</small></div>${withCopy ? `<button class="copybtn" data-copy="${h(itemNo(i))}">Copy #</button>` : ''}</div>`).join('') || '<p class="note">No items yet.</p>'}</div>
    <div class="box"><div class="bh">Value<span class="cpo"> / CPO</span></div>
      <div class="tot"><span>Value</span><span class="money">${money(t.value)}</span></div>
      <div class="tot"><span>Customer Pays</span><span class="money">${money(t.sub)}</span></div>
      ${t.bonusValue ? `<div class="tot cpo ${t.bonusOver ? 'overtxt' : ''}"><span>Bonus items (limit ${bonusLimit()}% = ${money(t.bonusAllowed)})</span><span>${money(t.bonusValue)}</span></div>` : ''}
      ${t.bonusPts ? `<div class="tot cpo"><span>CPO before bonus</span><span class="money">${money(t.cpoGross)}</span></div><div class="tot cpo"><span>Bonus points given</span><span>${t.bonusPts} pts</span></div>` : ''}
      <div class="tot grand cpo"><span>CPO</span><span class="money">${money(t.cpo)}</span></div>
      ${o.items.some(i => i.b && CATALOG.find(c => keyOf(c) === i.key && c.e)) ? '<p class="note cpo" style="margin:6px 0 0">Some CPO / point values are estimates (no 2026 source yet).</p>' : ''}</div>
    <div class="box"><div class="bh">Payment &amp; shipping</div>
      ${kv('Shipping Method', o.shipReq ? t.shipLabel + (t.shipCost ? ' (' + money(t.shipCost) + ')' : ' (Included)') : 'None', 'x')}${kv('Payment Method', o.pay.method, 'x')}${kv('Taxable', o.pay.taxable ? 'Taxable (' + o.pay.taxRate + '%' + (o.pay.taxSource === 'exact' ? ', exact' : ', estimate') + ')' : 'Tax Exempt', 'x')}${o.pay.taxable && o.pay.taxJuris ? kv('Tax area', o.pay.taxJuris, 'x') : ''}${kv('Payment Plan', t.n + ' payment' + (t.n > 1 ? 's' : ''), 'x')}${kv('Special instr.', o.pay.special)}${kv('Gift message', o.pay.gift)}${kv('My notes', o.info.notes)}</div>
    <div class="box"><div class="bh">Order totals</div>
      <div class="tot"><span>Item Subtotal</span><span class="money">${money(t.sub)}</span></div>
      <div class="tot"><span>Shipping Costs</span><span class="money">${o.shipReq && !t.shipCost ? 'Included' : money(t.shipCost)}</span></div>
      <div class="tot"><span>Admin Fees</span><span class="money">${money(t.fee)}</span></div>
      <div class="tot"><span>Total Before Tax</span><span class="money">${money(t.before)}</span></div>
      <div class="tot"><span>Sales Tax${o.pay.taxable ? ' (' + (o.pay.taxSource === 'exact' ? '' : 'est. ') + o.pay.taxRate + '%)' : ''}</span><span class="money">${money(t.tax)}</span></div>
      <div class="tot grand"><span>Order Total</span><span class="money">${money(t.total)}</span></div>
      ${t.n > 1 ? `<div class="tot" style="margin-top:6px"><span>First Payment</span><span class="money">${money(t.pays[0])}</span></div><div class="tot"><span>Remaining Balance</span><span class="money">${money(r2(t.total - t.pays[0]))}</span></div>${t.pays.slice(1).map((p, i) => `<div class="tot" style="color:var(--muted);font-size:13px"><span>Payment ${i + 2}</span><span>${money(p)}</span></div>`).join('')}` : ''}</div>`;
}

/* --- signature pad --- */
function initSig() {
  const c = $('#sig'); if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, hh = c.clientHeight;
  c.width = w * dpr; c.height = hh * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f3d5e';
  if (cur.sig) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, hh); im.src = cur.sig; }
  let drawing = false, last = null, moved = false;
  const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', e => { drawing = true; moved = false; last = pos(e); c.setPointerCapture(e.pointerId); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; moved = true; e.preventDefault(); });
  const end = e => { if (!drawing) return; drawing = false; if (!moved) { ctx.beginPath(); ctx.arc(last[0], last[1], 1.2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); } cur.sig = c.toDataURL('image/png'); c.classList.add('has'); persistCur(); };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('pointerleave', end);
  $('#sigClear').onclick = () => { ctx.clearRect(0, 0, w, hh); cur.sig = null; c.classList.remove('has'); persistCur(); };
}

/* --- editor event delegation --- */
$('#edBody').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'itemSearch') { itemQuery = t.value; const keep = t.selectionStart; renderStep(); const s = $('#itemSearch'); s.focus(); s.setSelectionRange(keep, keep); return; }
  if (t.id === 'cardNum') { curCard.number = t.value.replace(/\D/g, ''); const v = fmtCard(curCard.number); if (t.value !== v) { t.value = v; } return; }
  if (t.id === 'cardCvv') { curCard.cvv = t.value.replace(/\D/g, '').slice(0, 4); if (t.value !== curCard.cvv) t.value = curCard.cvv; return; }
  if (t.dataset.k !== undefined) {
    let v = t.type === 'checkbox' ? t.checked : t.value; if (t.type === 'number') v = t.value === '' ? '' : +t.value;
    set(cur, t.dataset.k, v); t.closest('.field') && t.closest('.field').classList.remove('err');
    if (t.dataset.manual !== undefined) { cur.pay.taxSource = 'manual'; cur.pay.taxJuris = ''; }
    updateTotal(); return;
  }
  const line = t.closest('.line'); if (!line) return;
  const it = cur.items.find(i => i.id === line.dataset.line); if (!it) return;
  if (t.dataset.lprice !== undefined) { it.price = +t.value || 0; it.manual = true; line.querySelector('.lp').textContent = money(it.qty * it.price); updateTotal(); $('.cart .hd span:last-child').textContent = money(totals(cur).sub); }
  if (t.dataset.lnote !== undefined) it.note = t.value;
});
$('#edBody').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'cardM') { curCard.expM = t.value; return; }
  if (t.id === 'cardY') { curCard.expY = t.value; return; }
  if (t.dataset.k !== undefined && t.tagName === 'SELECT') { set(cur, t.dataset.k, t.value); if (t.dataset.k === 'info.orderType') { repriceLines(); updateTotal(); } if (t.dataset.k.startsWith('bill.') || t.dataset.k.startsWith('ship.')) { if (cur.pay.taxSource !== 'manual') cur.pay.taxSource = 'default'; } return; }
  if (t.dataset.lfree !== undefined) { const line = t.closest('.line'); const it = cur.items.find(i => i.id === line.dataset.line); if (it) { it.free = t.checked; renderStep(); } return; }
  if (t.dataset.k !== undefined && t.type === 'checkbox') { set(cur, t.dataset.k, t.checked); return; }
  const line = t.closest('.line'); if (line && t.dataset.opt) { const it = cur.items.find(i => i.id === line.dataset.line); if (it) { it.opts[t.dataset.opt] = t.dataset.opt === 'cherry' ? !!t.value : t.value; line.querySelector('.ln small').firstChild.textContent = '#' + itemNo(it) + ' · CPO ' + money(lineCpo(it)); } }
});
$('#edBody').addEventListener('click', e => {
  const tile = e.target.closest('[data-open]');
  if (tile) { const [kind, val] = tile.dataset.open.split(/:(.+)/); if (kind === 'fam') optionsSheet({ fam: FAMILIES[+val] }); else optionsSheet({ key: val }); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'btnCartBar') { showCart(); return; }
  if (b.dataset.cat) { itemCat = b.dataset.cat; renderStep(); return; }
  if (b.dataset.add) { addItem(b.dataset.add); return; }
  if (b.id === 'btnCustomItem') { customItemSheet(); return; }
  if (b.id === 'btnTaxExact') { b.disabled = true; b.textContent = 'Looking up…'; lookupExactRate(taxAddress(cur)).then(ex => { cur.pay.taxRate = r2(ex.rate); cur.pay.taxSource = 'exact'; cur.pay.taxJuris = ex.label; toast('Exact rate ' + cur.pay.taxRate + '%'); }).catch(e => toast(navigator.onLine ? 'Could not look up: ' + e.message : 'No signal. Using the estimate.')).finally(() => { renderTaxBox(); updateTotal(); persistCur(); }); return; }
  if (b.id === 'btnTaxEst') { cur.pay.taxSource = 'default'; applyTax(cur, { online: false }).then(() => { renderTaxBox(); updateTotal(); persistCur(); }); return; }
  if (b.dataset.seg) {
    let v = b.dataset.val; if (v === 'true') v = true; else if (v === 'false') v = false; else if (b.dataset.seg === 'pay.plan') v = +v;
    set(cur, b.dataset.seg, v); if (b.dataset.seg === 'info.orderType') repriceLines(); renderStep(); return;
  }
  const line = b.closest('.line'); if (!line) return;
  const it = cur.items.find(i => i.id === line.dataset.line); if (!it) return;
  if (b.dataset.q) { it.qty = Math.max(1, it.qty + (+b.dataset.q)); renderStep(); }
  if (b.dataset.rm !== undefined) { cur.items = cur.items.filter(i => i !== it); renderStep(); }
});
$('#edBody').addEventListener('focusout', () => { if (cur) persistCur(); });

/* ---------- detail (read-only, made for re-entry) ---------- */
let dtId = null;
function openDetail(id) {
  const o = ORDERS.find(x => x.id === id); if (!o) { show('home'); return; }
  dtId = id; $('#dtTitle').textContent = custName(o);
  const lbl = { draft: 'In progress', ready: 'To enter', entered: 'Entered in Cutco' };
  $('#dtBody').innerHTML = `
    <div class="box"><div class="bh"><span class="badge ${o.status}">${lbl[o.status]}</span><span class="spacer"></span>${o.enteredAt ? '<small style="color:var(--muted)">entered ' + new Date(o.enteredAt).toLocaleDateString() + '</small>' : ''}</div>
    <p class="note" style="margin:0">Tap <b>Copy</b> next to a field, then paste it into the Cutco app.</p></div>
    ${summaryHtml(o, true)}
    <div class="box"><div class="bh">Card details<span class="spacer"></span>${o.card ? `<button class="btn small" id="btnShowCard">Show</button>` : ''}</div>
      <div id="cardArea">${o.card ? `<div class="kv"><div class="k">Card</div><div class="v">····${h(o.cardLast4)} (tap Show)</div></div>` : (o.cardLast4 ? `<div class="kv"><div class="v">Card ····${h(o.cardLast4)} — number was erased</div></div>` : `<div class="kv"><div class="v">No card saved${o.pay.method !== 'Credit/Debit Card' ? ' (' + h(o.pay.method) + ')' : ''}</div></div>`)}</div></div>
    <div class="box"><div class="bh">Signature${o.pay.notPresent ? ' <small style="font-weight:400;color:var(--muted)">(customer not present)</small>' : ''}</div>${o.sig ? `<img class="sigimg" src="${o.sig}" alt="signature">` : '<p class="note" style="margin:0">No signature captured.</p>'}</div>
    <div class="status-actions">
      ${o.status !== 'entered' ? `<button class="btn primary wide" id="btnEntered">✓ Mark as entered in Cutco</button><p class="note" style="margin:0 0 4px">This erases the card number from the phone.</p>` : `<button class="btn wide" id="btnReopen">Move back to “To enter”</button>`}
      ${o.status === 'draft' ? `<button class="btn wide" id="btnReady">Mark as ready to enter</button>` : ''}
      <button class="btn wide" id="btnShareOne">Share / email this order</button>
      <button class="btn danger wide" id="btnDelete">Delete order</button>
    </div>`;
  show('detail');
}
$('#btnDtBack').onclick = () => { renderHome(); show('home'); };
$('#btnDtEdit').onclick = () => { const o = ORDERS.find(x => x.id === dtId); if (o) openEditor(o, false); };
$('#dtBody').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const o = ORDERS.find(x => x.id === dtId); if (!o) return;
  if (b.dataset.copy !== undefined) { copyText(b.dataset.copy); return; }
  if (b.id === 'btnShowCard') {
    try {
      const c = await CR.dec(KEY, o.card);
      $('#cardArea').innerHTML = `<div class="kv"><div class="k">Card Number</div><div class="v mono">${h(fmtCard(c.number))}</div><button class="copybtn" data-copy="${h(c.number)}">Copy</button></div>
        <div class="kv"><div class="k">Expiration</div><div class="v mono">${h(c.expM)} / ${h(c.expY)}</div><button class="copybtn" data-copy="${h(c.expM + '/' + c.expY)}">Copy</button></div>
        ${c.cvv ? `<div class="kv"><div class="k">CVV</div><div class="v mono">${h(c.cvv)}</div><button class="copybtn" data-copy="${h(c.cvv)}">Copy</button></div>` : ''}`;
      b.remove();
    } catch (err) { toast('Could not decrypt card. Was the PIN reset?'); }
    return;
  }
  if (b.id === 'btnEntered') {
    if (await confirmSheet('Entered in Cutco?', 'Mark this order as entered and <b>erase the card number</b> from this phone. The rest of the order stays for your records.', 'Yes, entered')) {
      o.status = 'entered'; o.enteredAt = Date.now(); o.card = null; o.updatedAt = Date.now(); saveOrders(); openDetail(o.id); toast('Marked as entered. Card erased.');
    }
    return;
  }
  if (b.id === 'btnReady') { o.status = 'ready'; o.updatedAt = Date.now(); saveOrders(); openDetail(o.id); return; }
  if (b.id === 'btnReopen') { o.status = 'ready'; o.updatedAt = Date.now(); saveOrders(); openDetail(o.id); return; }
  if (b.id === 'btnShareOne') { shareText('Cutco order — ' + custName(o), orderText(o)); return; }
  if (b.id === 'btnDelete') {
    if (await confirmSheet('Delete this order?', 'This cannot be undone.', 'Delete', true)) { ORDERS = ORDERS.filter(x => x.id !== o.id); saveOrders(); renderHome(); show('home'); }
  }
});
function copyText(txt) {
  const done = () => toast('Copied');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy not available'); } ta.remove(); }
}

/* ---------- text export (never includes card data) ---------- */
function orderText(o) {
  const t = totals(o);
  const addr = a => [a.first + ' ' + a.last, a.company, a.addr1, a.addr2, [a.city, a.state].filter(Boolean).join(', ') + (a.zip ? ' ' + a.zip : ''), a.phone ? 'phone: ' + a.phone : '', a.alt ? 'alt: ' + a.alt : '', a.email ? 'email: ' + a.email : ''].filter(x => x && x.trim()).join('\n  ');
  const L = [];
  L.push(`ORDER: ${custName(o)} — ${fmtDate(o.info.orderDate)} — ${money(t.total)} [${o.status === 'entered' ? 'ENTERED' : o.status === 'ready' ? 'TO ENTER' : 'IN PROGRESS'}]`);
  if (o.info.event) L.push('Event: ' + o.info.event);
  L.push(`Customer Type: ${o.info.customerType} | Order Type: ${o.info.orderType} | Marketing: ${o.info.marketing || 'None'} | Language: ${o.bill.lang}`);
  L.push('BILLING:\n  ' + addr(o.bill));
  L.push('SHIPPING: ' + (!o.shipReq ? 'not required' : o.shipSame ? 'same as billing' : '\n  ' + addr(o.ship)));
  L.push('ITEMS:\n' + o.items.map(i => `  ${i.qty} x #${itemNo(i)} ${itemLabel(i)} — ${i.free ? 'BONUS' : money(i.qty * i.price)} (CPO ${money(lineCpo(i))})`).join('\n'));
  L.push(`VALUE ${money(t.value)} | CUSTOMER PAYS ${money(t.sub)} | CPO ${money(t.cpo)}` + (t.bonusPts ? ` (after ${t.bonusPts} bonus pts; bonus items ${money(t.bonusValue)} of ${money(t.bonusAllowed)} allowed)` : ''));
  L.push(`PAYMENT: ${o.pay.method} | ${t.n} payment${t.n > 1 ? 's of ' + money(t.pays[0]) : ''} | Shipping: ${o.shipReq ? t.shipLabel : 'none'} | ${o.pay.taxable ? 'Taxable ' + o.pay.taxRate + '%' + (o.pay.taxSource === 'exact' ? ' (exact)' : ' (est.)') : 'Tax exempt'}` + (o.cardLast4 ? ` | Card ending ${o.cardLast4} (number is only on the phone)` : ''));
  L.push(`TOTALS: subtotal ${money(t.sub)}, shipping ${money(t.shipCost)}, admin fee ${money(t.fee)}, tax (est.) ${money(t.tax)}, TOTAL ${money(t.total)}`);
  if (o.pay.special) L.push('Special instructions: ' + o.pay.special);
  if (o.pay.gift) L.push('Gift message: ' + o.pay.gift);
  if (o.info.notes) L.push('My notes: ' + o.info.notes);
  L.push('Signature: ' + (o.sig ? 'captured on phone' : 'none') + (o.pay.notPresent ? ' (customer not present)' : ''));
  return L.join('\n');
}
async function shareText(subject, body) {
  if (navigator.share) { try { await navigator.share({ title: subject, text: body }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const to = SETTINGS.email ? encodeURIComponent(SETTINGS.email) : '';
  location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ---------- settings ---------- */
let catQuery = '';
function renderSettings() {
  const ready = ORDERS.filter(o => o.status === 'ready').length, entered = ORDERS.filter(o => o.status === 'entered').length;
  $('#stBody').innerHTML = `
    <h2 class="sec">Defaults for new orders</h2>
    <div class="st-row"><div class="l">Fallback tax rate<small>Used only when the address can't be matched (%)</small></div><input type="number" inputmode="decimal" step="0.001" data-s="taxRate" value="${h(SETTINGS.taxRate)}"></div>
    <div class="st-row"><div class="l">California tax table<small>${Object.keys(TAX.cities).length} cities · updated ${h(TAX.updated || 'built-in')}. Exact rates are looked up per address when you have signal.</small></div><button class="btn small" id="btnTaxRefresh">Refresh</button></div>
    <div class="st-row"><div class="l">Event<small>Number and name, as shown in the Cutco app</small><input type="text" class="wide" data-s="event" value="${h(SETTINGS.event)}" placeholder="00095706-Santa Cruz County Fair (Watsonville)" style="margin-top:6px"></div></div>
    <div class="field"><label>Customer Type</label><select data-s="customerType">${CUSTOMER_TYPES.map(c => `<option ${SETTINGS.customerType === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></div>
    <div class="field"><label>Order Type</label><select data-s="orderType">${ORDER_TYPES.map(c => `<option ${SETTINGS.orderType === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></div>
    <div class="field"><label>Email orders to</label><input type="email" data-s="email" value="${h(SETTINGS.email)}" placeholder="your email" autocapitalize="none"></div>
    <h2 class="sec">Customer-facing</h2>
    <div class="st-row"><div class="l">Bonus limit<small>Bonus (free) items can't add up to more than this share of what the customer pays. At 10%, $1,000 of paid items allows $100 of bonus items.</small><div class="slider"><input type="range" min="0" max="30" step="1" data-s="bonusLimit" value="${h(bonusLimit())}"><b id="bonusLbl">${bonusLimit()}%</b></div></div></div>
    <label class="check st-row"><input type="checkbox" data-s="hideCpo" ${SETTINGS.hideCpo ? 'checked' : ''}> <span class="l">Customer view<small>Hide CPO and point values everywhere. The eye button on the order screen toggles this too.</small></span></label>
    <h2 class="sec">Security</h2>
    <button class="btn wide" id="btnChangePin">Change PIN</button>
    <button class="btn wide" id="btnLockNow">Lock now</button>
    <p class="note">The app locks itself after 5 minutes in the background and every time it is reopened.</p>
    <h2 class="sec">Catalog prices</h2>
    <p class="note">Catalog: ${h(CATALOG_VERSION)}. Change any price here; changed prices are highlighted. Send new Cutco price lists to get the whole catalog (prices, CPO, points, new items) regenerated.</p>
    <div class="search"><input id="catSearch" placeholder="Search name or item #" value="${h(catQuery)}" autocomplete="off"></div>
    <div class="box" id="catList">${catListHtml()}</div>
    <button class="btn wide" id="btnResetPrices">Reset all prices to defaults</button>
    <h2 class="sec">Backup</h2>
    <p class="note">${ORDERS.length} orders on this phone (${ready} to enter, ${entered} entered). Backups never include card numbers.</p>
    <button class="btn wide" id="btnBackup">Download backup file</button>
    <button class="btn wide" id="btnRestore">Restore from backup file</button>
    <button class="btn danger wide" id="btnPurge">Delete all entered orders</button>
    <h2 class="sec">About</h2>
    <p class="note">Festival Orders v${APP_VERSION}. Add to your home screen (Safari → Share → Add to Home Screen) so it opens offline and keeps its data. Open it once with signal after each update.</p>`;
}
function catListHtml() {
  const q = catQuery.trim().toLowerCase();
  const prods = allProducts().filter(p => !q || (p.name + ' ' + p.b).toLowerCase().includes(q)).slice(0, q ? 80 : 25);
  return prods.map(p => { const base = CATALOG.find(c => keyOf(c) === p.key); return `<div class="catrow"><div class="cn">${h(p.name)}<small>#${h(p.b)}${p.sfx ? ' (' + h(p.sfx) + ')' : ''}${base ? ` · CPO ${money(p.cpo)} · ${p.pts} pts${p.g != null ? ' · gift ' + money(p.g) : ''}` : ' · custom'}</small></div><input type="number" inputmode="decimal" step="0.01" data-price="${h(p.key)}" value="${p.p}" class="${base && PRICE_OVR[p.key] != null && PRICE_OVR[p.key] !== base.p ? 'changed' : ''}">${base ? '' : `<button class="rm" data-delcustom="${h(p.key)}" style="color:var(--red);background:none;border:0">✕</button>`}</div>`; }).join('') + (q ? '' : '<p class="note" style="margin:6px 0 0">Search to find more items.</p>');
}
$('#btnStBack').onclick = () => { saveSettings(); renderHome(); show('home'); };
$('#stBody').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.s) { SETTINGS[t.dataset.s] = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.type === 'range') ? (+t.value || 0) : t.value; saveSettings(); if (t.dataset.s === 'bonusLimit') { $('#bonusLbl').textContent = bonusLimit() + '%'; } if (t.dataset.s === 'hideCpo') applyCustomerView(); return; }
  if (t.id === 'catSearch') { catQuery = t.value; $('#catList').innerHTML = catListHtml(); return; }
  if (t.dataset.price) {
    const n = t.dataset.price, v = +t.value || 0; const base = CATALOG.find(c => keyOf(c) === n);
    if (base) { if (v === base.p) delete PRICE_OVR[n]; else PRICE_OVR[n] = v; LS.write('fo.prices', PRICE_OVR); t.classList.toggle('changed', v !== base.p); }
    else { const c = CUSTOM_ITEMS.find(x => x.b === n); if (c) { c.p = v; LS.write('fo.custom', CUSTOM_ITEMS); } }
  }
});
$('#stBody').addEventListener('change', e => { const t = e.target; if (t.dataset.s && t.tagName === 'SELECT') { SETTINGS[t.dataset.s] = t.value; saveSettings(); } });
$('#stBody').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'btnTaxRefresh') { b.disabled = true; b.textContent = '…'; refreshTaxTable().then(() => { toast('Tax table updated'); renderSettings(); }).catch(() => { toast(navigator.onLine ? 'Could not download the table' : 'No signal'); renderSettings(); }); return; }
  if (b.dataset.delcustom) { CUSTOM_ITEMS = CUSTOM_ITEMS.filter(c => c.b !== b.dataset.delcustom); LS.write('fo.custom', CUSTOM_ITEMS); $('#catList').innerHTML = catListHtml(); return; }
  if (b.id === 'btnResetPrices') { if (await confirmSheet('Reset prices?', 'All price changes you made will go back to the defaults.', 'Reset')) { PRICE_OVR = {}; LS.write('fo.prices', PRICE_OVR); $('#catList').innerHTML = catListHtml(); } return; }
  if (b.id === 'btnLockNow') { showLock(); return; }
  if (b.id === 'btnChangePin') { changePinSheet(); return; }
  if (b.id === 'btnBackup') {
    const data = { app: 'festival-orders', v: 1, exportedAt: new Date().toISOString(), settings: SETTINGS, prices: PRICE_OVR, custom: CUSTOM_ITEMS, orders: ORDERS.map(o => Object.assign({}, o, { card: null })) };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'festival-orders-' + today() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return;
  }
  if (b.id === 'btnRestore') { $('#fileRestore').click(); return; }
  if (b.id === 'btnPurge') {
    const n = ORDERS.filter(o => o.status === 'entered').length;
    if (!n) { toast('No entered orders'); return; }
    if (await confirmSheet('Delete entered orders?', `${n} order${n > 1 ? 's' : ''} marked as entered will be deleted from this phone.`, 'Delete', true)) { ORDERS = ORDERS.filter(o => o.status !== 'entered'); saveOrders(); renderSettings(); }
  }
});
$('#fileRestore').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'festival-orders' || !Array.isArray(d.orders)) throw 0;
    let added = 0; d.orders.forEach(o => { if (!ORDERS.find(x => x.id === o.id)) { o.card = null; ORDERS.push(o); added++; } });
    saveOrders(); if (d.prices) { PRICE_OVR = Object.assign(PRICE_OVR, d.prices); LS.write('fo.prices', PRICE_OVR); }
    if (Array.isArray(d.custom)) { d.custom.forEach(c => { if (c.n && !c.b) c.b = c.n; if (!CUSTOM_ITEMS.find(x => x.b === c.b)) CUSTOM_ITEMS.push(c); }); LS.write('fo.custom', CUSTOM_ITEMS); }
    toast(`Restored ${added} order${added === 1 ? '' : 's'}`); renderSettings();
  } catch (err) { toast('That is not a Festival Orders backup file'); }
  e.target.value = '';
});
function changePinSheet() {
  openSheet(`<h3>Change PIN</h3>
    <div class="field"><label>New PIN</label><input id="np1" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
    <div class="field"><label>Again</label><input id="np2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
    <p class="note">4 to 6 digits. Saved card numbers are re-locked with the new PIN.</p>
    <div class="acts"><button class="btn" id="npCancel">Cancel</button><button class="btn primary" id="npOk">Change</button></div>`);
  $('#npCancel').onclick = closeSheet;
  $('#npOk').onclick = async () => {
    const a = $('#np1').value, b = $('#np2').value;
    if (!/^\d{4,6}$/.test(a)) { toast('Use 4 to 6 digits'); return; }
    if (a !== b) { toast('PINs do not match'); return; }
    $('#npOk').disabled = true; await rekeyAll(a); closeSheet(); toast('PIN changed');
  };
}

/* ---------- boot ---------- */
if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }
CUSTOM_ITEMS.forEach(c => { if (c.n && !c.b) c.b = c.n; });
maybeAutoRefreshTax();
applyCustomerView();
showLock();
window.__fo = { get ORDERS() { return ORDERS; }, get cur() { return cur; }, SETTINGS, totals, newOrder, orderText, estimateRate, lookupExactRate, itemNo, allProducts };
