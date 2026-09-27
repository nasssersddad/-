// سوق الحلال: لاعبين افتراضيين، مساومة، مقايضة، بيع وشراء
// كل العمليات تمر من هنا، عشان نقدر نبدّل هالمزوّد بسوق أونلاين حقيقي بعدين بدون ما نغيّر الواجهة
import { BREEDS, RARES } from '../data/camels.js';
import { makeCamel, camelValue, camelById, capacity } from './camels.js';
import { mulberry32, hashString, pick, randInt } from './util.js';
import { addStat } from './inventory.js';

export const TRADER_NAMES = ['ذيب_الشمال', 'بو_راشد99', 'شايب_الإبل', 'ملك_المزاين', 'ولد_البادية', 'صقر_نجد', 'أبو_سلطان', 'حلال_العتيبي', 'راعي_الوضح', 'مهرة_الصحراء', 'بو_فهد_الحربي', 'ناقة_وبس', 'تاجر_الطايف', 'شيخ_الجمّالة', 'سلطان_المجاهيم', 'غزال_القصيم'];

// الشخصيات: maxMul = أعلى سعر يدفعه نسبة للقيمة، minMul = أقل سعر يبيع فيه، patience = كم مرة يتحمل المساومة، step = كم يتحرك باتجاهك
export const PERSONAS = {
  generous: { name: 'كريم',   maxMul: 1.18, minMul: 0.9,  askMul: 1.2,  patience: 4, step: 0.55 },
  stingy:   { name: 'مفاصل',  maxMul: 0.95, minMul: 1.0,  askMul: 1.35, patience: 4, step: 0.3 },
  hurry:    { name: 'مستعجل', maxMul: 1.05, minMul: 0.85, askMul: 1.15, patience: 1, step: 0.7 },
  stubborn: { name: 'عنيد',   maxMul: 1.08, minMul: 1.02, askMul: 1.45, patience: 5, step: 0.18 },
  lowball:  { name: 'نصّاب',  maxMul: 0.82, minMul: 1.1,  askMul: 1.6,  patience: 2, step: 0.25 },
};

export const LINES = {
  accept: ['تم! الله يبارك لك فيها 🤝', 'اتفقنا، على البركة.', 'خلاص يا شيخ، لك اللي تبي.', 'ماشي، ولا يهمك.'],
  counter: ['والله إنها ما تسوى، آخر كلام {x}', 'لا لا، كثير! أعطيك {x} وخلصنا.', 'شف، {x} وأنا خسران.', 'هاه؟ {x} وإلا مع السلامة.', 'يا رجال {x} سعر زين.'],
  final: ['هذا آخر سعر عندي: {x}. تبيها وإلا لا؟', 'ما أزيد ولا درهم: {x}.'],
  leave: ['ما عندك سالفة، مع السلامة. 😤', 'الله يرزقك بغيري.', 'خلها لك، أنا ماشي.'],
  insult: ['تستهبل؟ 😂 هذا السعر إهانة!', 'لا تضيّع وقتي يا خوي.'],
  open: ['السلام عليكم، شفت ناقتك {n}، أعطيك {x}.', 'عاجبتني {n}! كم آخرها؟ أنا أعطيك {x}.', 'يا مرحبا، أبي {n} بـ {x}.'],
  openRare: ['🔥 والله إنها نادرة! أدفع فيها {x}!', 'سمعت عن {n}... أعطيك {x} الحين!'],
  sellerOpen: ['هلا، سعري {x}. عاجبتك؟', 'ناقة ما تتكرر، سعرها {x}.'],
};

function line(rng, key, vars = {}) {
  let s = pick(rng, LINES[key]);
  for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', typeof v === 'number' ? fmt(v) : v);
  return s;
}

export function fmt(n) {
  return Math.round(n).toLocaleString('en');
}

function round(n) {
  if (n >= 10000) return Math.round(n / 500) * 500;
  if (n >= 1000) return Math.round(n / 50) * 50;
  return Math.round(n / 10) * 10;
}

export function emptyMarket() {
  return { day: 0, listings: [], barters: [], myListings: [], offers: [], history: [], index: {}, prevIndex: {}, seq: 0, lastTick: 0, dealDay: 0, newOffersToday: 0 };
}

// ---------- مؤشر السوق ----------
export function marketIndex(seed, day) {
  const rng = mulberry32(hashString('idx:' + seed + ':' + day));
  const idx = {};
  for (const b of Object.keys(BREEDS)) idx[b] = Math.round((0.8 + rng() * 0.45) * 100) / 100;
  return idx;
}

export function valueOf(state, c) {
  const m = state.market;
  return camelValue(c, (m.index && m.index[c.breed]) || 1);
}

// ---------- تحديث يومي للعروض ----------
export function refreshDaily(state, day) {
  const m = state.market;
  if (m.day === day) return false;
  m.prevIndex = m.index && Object.keys(m.index).length ? m.index : marketIndex(state.seed, day - 1);
  m.index = marketIndex(state.seed, day);
  m.day = day;
  m.newOffersToday = 0;
  const rng = mulberry32(hashString('mk:' + state.seed + ':' + day));
  m.listings = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const rare = rng() < 0.12 && i === 0 ? pick(rng, Object.keys(RARES)) : null;
    const cam = makeCamel({ camelSeq: day * 100 + i }, rng, { rare, ageDays: rng() < 0.3 ? randInt(rng, 0, 2) : 3 + randInt(rng, 0, 6) });
    const persona = pick(rng, Object.keys(PERSONAS));
    const value = camelValue(cam, m.index[cam.breed] || 1);
    const P = PERSONAS[persona];
    m.listings.push({
      id: 'L' + day + '_' + i,
      seller: pick(rng, TRADER_NAMES), persona,
      camel: cam, value,
      ask: round(value * P.askMul * (0.95 + rng() * 0.15)),
      min: round(value * P.minMul),
      rounds: 0, log: [], closed: false,
    });
  }
  m.barters = [];
  if (state.camels && state.camels.length) {
    for (let i = 0; i < 2; i++) {
      const want = pick(rng, state.camels);
      const give = makeCamel({ camelSeq: day * 100 + 50 + i }, rng, { ageDays: 3 + randInt(rng, 0, 4) });
      const persona = pick(rng, Object.keys(PERSONAS));
      const wantV = camelValue(want, m.index[want.breed] || 1);
      const giveV = camelValue(give, m.index[give.breed] || 1);
      const fair = wantV - giveV;
      const coins = round(Math.max(0, fair * PERSONAS[persona].maxMul * (0.85 + rng() * 0.2)));
      m.barters.push({ id: 'B' + day + '_' + i, trader: pick(rng, TRADER_NAMES), persona, wantId: want.id, give, coins, maxCoins: round(Math.max(coins, fair * PERSONAS[persona].maxMul * 1.1)), rounds: 0, log: [], closed: false });
    }
  }
  return true;
}

// ---------- عروضي (أبيع) ----------
export function listCamel(state, camelId, ask, nowMs) {
  const m = state.market;
  const c = camelById(state, camelId);
  if (!c || m.myListings.some(l => l.camelId === camelId)) return null;
  m.seq += 1;
  const l = { id: 'M' + m.seq, camelId, ask: Math.max(10, Math.round(ask)), created: nowMs, nextOfferAt: nowMs + 15000 };
  m.myListings.push(l);
  return l;
}

export function unlist(state, listingId) {
  const m = state.market;
  m.myListings = m.myListings.filter(l => l.id !== listingId);
  m.offers = m.offers.filter(o => o.listingId !== listingId);
}

// يولّد عروض المشترين مع الوقت. يرجع العروض الجديدة
export function tick(state, nowMs, rng) {
  const m = state.market;
  const fresh = [];
  for (const l of m.myListings) {
    const c = camelById(state, l.camelId);
    if (!c) continue;
    let guard = 0;
    while (nowMs >= l.nextOfferAt && guard++ < 3) {
      const open = m.offers.filter(o => o.listingId === l.id && !o.closed);
      const value = valueOf(state, c);
      l.nextOfferAt += (c.rare ? 12000 : 30000) + rng() * (c.rare ? 20000 : 60000);
      if (open.length >= 3 || m.newOffersToday >= 20) continue;
      const persona = pick(rng, Object.keys(PERSONAS));
      const P = PERSONAS[persona];
      const maxPay = round(value * P.maxMul * (0.92 + rng() * 0.2) * (c.rare ? 1 + rng() * 0.4 : 1));
      const best = open.reduce((a, o) => Math.max(a, o.amount), 0);
      let amount = c.rare && best ? round(Math.min(maxPay, best * (1.03 + rng() * 0.09))) : round(Math.min(maxPay, value * (0.62 + rng() * 0.3)));
      if (l.ask <= maxPay && rng() < 0.35) amount = l.ask;
      if (c.rare && best && amount <= best) continue;
      m.seq += 1;
      m.newOffersToday += 1;
      const buyer = pick(rng, TRADER_NAMES);
      const o = {
        id: 'O' + m.seq, listingId: l.id, camelId: c.id, buyer, persona, maxPay, amount, rounds: 0, closed: false,
        log: [{ who: 'them', text: line(rng, c.rare ? 'openRare' : 'open', { n: c.name, x: amount }) }],
      };
      m.offers.push(o);
      fresh.push(o);
    }
  }
  return fresh;
}

function sellCamel(state, camelId, price, to) {
  const c = camelById(state, camelId);
  if (!c) return false;
  state.camels = state.camels.filter(x => x.id !== camelId);
  state.player.coins += price;
  addStat(state, 'coinsEarned', price);
  addStat(state, 'marketSales', 1);
  const m = state.market;
  const l = m.myListings.find(x => x.camelId === camelId);
  if (l) unlist(state, l.id);
  m.offers = m.offers.filter(o => o.camelId !== camelId);
  m.barters = m.barters.filter(b => b.wantId !== camelId);
  m.history.unshift({ type: 'sell', name: c.name, rare: c.rare, price, to, day: state.time.day });
  m.history = m.history.slice(0, 30);
  return true;
}

export function acceptOffer(state, offerId) {
  const o = state.market.offers.find(x => x.id === offerId && !x.closed);
  if (!o) return null;
  const c = camelById(state, o.camelId);
  const price = o.amount;
  if (!sellCamel(state, o.camelId, price, o.buyer)) return null;
  return { price, camel: c, buyer: o.buyer };
}

export function rejectOffer(state, offerId) {
  const m = state.market;
  m.offers = m.offers.filter(o => o.id !== offerId);
}

// أنت تساوم المشتري: تطلب سعر أعلى
export function counterOffer(state, offerId, price, rng) {
  const o = state.market.offers.find(x => x.id === offerId && !x.closed);
  if (!o) return null;
  price = Math.round(price);
  o.log.push({ who: 'me', text: `أبيها بـ ${fmt(price)}` });
  if (price <= o.maxPay) {
    o.amount = price;
    o.log.push({ who: 'them', text: line(rng, 'accept') });
    return { result: 'accept', amount: price };
  }
  o.rounds += 1;
  const P = PERSONAS[o.persona];
  if (price > o.maxPay * 2.2) o.rounds += 1;
  if (o.rounds > P.patience) {
    o.closed = true;
    o.log.push({ who: 'them', text: line(rng, 'leave') });
    state.market.offers = state.market.offers.filter(x => x.id !== o.id);
    return { result: 'leave' };
  }
  const next = round(Math.min(o.maxPay, o.amount + (price - o.amount) * P.step));
  const isFinal = next >= o.maxPay || o.rounds === P.patience;
  o.amount = Math.max(o.amount, next);
  o.log.push({ who: 'them', text: price > o.maxPay * 2.2 ? line(rng, 'insult') + ' ' + line(rng, 'counter', { x: o.amount }) : line(rng, isFinal ? 'final' : 'counter', { x: o.amount }) });
  return { result: 'counter', amount: o.amount, final: isFinal };
}

// ---------- الشراء من السوق ----------
export function buyAtAsk(state, listingId) {
  return tryBuy(state, listingId, null);
}

function tryBuy(state, listingId, price) {
  const m = state.market;
  const l = m.listings.find(x => x.id === listingId && !x.closed);
  if (!l) return { result: 'gone' };
  const pay = price == null ? l.ask : price;
  if (state.player.coins < pay) return { result: 'poor' };
  if (state.camels.length >= capacity(state)) return { result: 'full' };
  if (!state.built.stable) return { result: 'nostable' };
  state.player.coins -= pay;
  l.closed = true;
  const cam = { ...l.camel, id: 'c' + (++state.camelSeq) + '_m', fedDay: null, wateredDay: null, milkedDay: null, pregnant: null };
  state.camels.push(cam);
  addStat(state, 'marketBuys', 1);
  m.history.unshift({ type: 'buy', name: cam.name, rare: cam.rare, price: pay, to: l.seller, day: state.time.day });
  m.history = m.history.slice(0, 30);
  return { result: 'bought', price: pay, camel: cam };
}

// أنت تساوم البياع: تعرض سعر أقل
export function haggleBuy(state, listingId, price, rng) {
  const l = state.market.listings.find(x => x.id === listingId && !x.closed);
  if (!l) return { result: 'gone' };
  price = Math.round(price);
  l.log.push({ who: 'me', text: `أعطيك ${fmt(price)}` });
  if (price >= l.min || price >= l.ask) {
    const res = tryBuy(state, listingId, Math.min(price, l.ask));
    if (res.result === 'bought') l.log.push({ who: 'them', text: line(rng, 'accept') });
    return res;
  }
  l.rounds += 1;
  const P = PERSONAS[l.persona];
  if (price < l.value * 0.45) l.rounds += 1;
  if (l.rounds > P.patience) {
    l.log.push({ who: 'them', text: line(rng, 'leave') });
    l.angry = true;
    return { result: 'leave' };
  }
  const next = round(Math.max(l.min, l.ask - (l.ask - price) * P.step));
  const isFinal = next <= l.min || l.rounds === P.patience;
  l.ask = Math.min(l.ask, next);
  l.log.push({ who: 'them', text: price < l.value * 0.45 ? line(rng, 'insult') + ' ' + line(rng, 'counter', { x: l.ask }) : line(rng, isFinal ? 'final' : 'counter', { x: l.ask }) });
  return { result: 'counter', amount: l.ask, final: isFinal };
}

// ---------- المقايضة ----------
export function acceptBarter(state, barterId) {
  const m = state.market;
  const b = m.barters.find(x => x.id === barterId && !x.closed);
  if (!b) return null;
  const mine = camelById(state, b.wantId);
  if (!mine) return null;
  state.camels = state.camels.filter(c => c.id !== mine.id);
  const got = { ...b.give, id: 'c' + (++state.camelSeq) + '_b', fedDay: null, wateredDay: null, milkedDay: null, pregnant: null };
  state.camels.push(got);
  state.player.coins += b.coins;
  if (b.coins) addStat(state, 'coinsEarned', b.coins);
  addStat(state, 'barters', 1);
  b.closed = true;
  const l = m.myListings.find(x => x.camelId === mine.id);
  if (l) unlist(state, l.id);
  m.history.unshift({ type: 'barter', name: mine.name, got: got.name, price: b.coins, to: b.trader, day: state.time.day });
  return { gave: mine, got, coins: b.coins };
}

// تطلب فرق دراهم أكثر بالمقايضة
export function haggleBarter(state, barterId, coins, rng) {
  const b = state.market.barters.find(x => x.id === barterId && !x.closed);
  if (!b) return null;
  coins = Math.round(coins);
  b.log.push({ who: 'me', text: `زِد ${fmt(coins)} درهم وتم` });
  if (coins <= b.maxCoins) {
    b.coins = coins;
    b.log.push({ who: 'them', text: line(rng, 'accept') });
    return { result: 'accept', coins };
  }
  b.rounds += 1;
  const P = PERSONAS[b.persona];
  if (b.rounds > P.patience) {
    b.closed = true;
    b.log.push({ who: 'them', text: line(rng, 'leave') });
    return { result: 'leave' };
  }
  b.coins = round(Math.min(b.maxCoins, b.coins + (coins - b.coins) * P.step));
  b.log.push({ who: 'them', text: line(rng, 'counter', { x: b.coins }) + ' (فرق)' });
  return { result: 'counter', coins: b.coins };
}

export function openOffersCount(state) {
  return state.market.offers.filter(o => !o.closed).length;
}
