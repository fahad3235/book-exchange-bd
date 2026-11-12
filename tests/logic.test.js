// book-exchange-bd -- node unit tests for js/logic.js
// Usage: node tests/logic.test.js  (exits non-zero on any failure)
const L = require('../js/logic.js');

let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}

function goodForm(over) {
  return Object.assign({
    title: 'Data Structures in C', author: 'Seymour Lipschutz', subject: 'CSE',
    condition: 'good', type: 'sale', price: 350, seller: 'Fahad',
    phone: '01712345678', area: 'Dhanmondi', notes: '2nd edition'
  }, over || {});
}

// --- phone validation ---
check('phone 01712345678 valid', L.isValidPhone('01712345678'));
check('phone with dash valid', L.isValidPhone('01712-345678'));
check('phone with spaces valid', L.isValidPhone('01712 345678'));
check('phone +880 prefix valid', L.isValidPhone('+8801712345678'));
check('phone 880 prefix valid', L.isValidPhone('8801712345678'));
check('phone 012 rejected (no 012 series)', !L.isValidPhone('01212345678'));
check('phone 011 rejected', !L.isValidPhone('01112345678'));
check('phone 10 digits rejected', !L.isValidPhone('0171234567'));
check('phone 12 digits rejected', !L.isValidPhone('017123456789'));
check('phone letters rejected', !L.isValidPhone('01712abc678'));
check('phone empty rejected', !L.isValidPhone(''));
check('normalize +880 -> 0', L.normalizePhone('+8801712345678') === '01712345678');
check('normalize dash stripped', L.normalizePhone('01712-345678') === '01712345678');

// --- validateListing ---
let r = L.validateListing(goodForm());
check('good sale form ok', r.ok && r.value.price === 350 && r.value.phone === '01712345678', JSON.stringify(r.errors));
r = L.validateListing(goodForm({ title: '' }));
check('missing title -> required', !r.ok && r.errors.title === 'required');
r = L.validateListing(goodForm({ title: 'x'.repeat(121) }));
check('title 121 chars -> titleLong', !r.ok && r.errors.title === 'titleLong');
r = L.validateListing(goodForm({ title: 'x'.repeat(120) }));
check('title 120 chars ok', r.ok, JSON.stringify(r.errors));
r = L.validateListing(goodForm({ author: '' }));
check('missing author -> required', !r.ok && r.errors.author === 'required');
r = L.validateListing(goodForm({ subject: 'Astrology' }));
check('unknown subject -> required', !r.ok && r.errors.subject === 'required');
r = L.validateListing(goodForm({ condition: 'mint' }));
check('unknown condition -> required', !r.ok && r.errors.condition === 'required');
r = L.validateListing(goodForm({ type: 'rent' }));
check('unknown type -> required', !r.ok && r.errors.type === 'required');
r = L.validateListing(goodForm({ type: 'sale', price: 0 }));
check('sale price 0 -> price error', !r.ok && r.errors.price === 'price');
r = L.validateListing(goodForm({ type: 'sale', price: '' }));
check('sale empty price -> price error', !r.ok && r.errors.price === 'price');
r = L.validateListing(goodForm({ type: 'free', price: 100 }));
check('free with price normalises to 0', r.ok && r.value.price === 0, JSON.stringify(r.errors));
r = L.validateListing(goodForm({ type: 'swap', price: 500 }));
check('swap with price normalises to 0', r.ok && r.value.price === 0);
r = L.validateListing(goodForm({ price: 1000001 }));
check('price over cap -> priceRange', !r.ok && r.errors.price === 'priceRange');
r = L.validateListing(goodForm({ price: 1000000 }));
check('price at cap ok', r.ok, JSON.stringify(r.errors));
r = L.validateListing(goodForm({ price: -5 }));
check('negative price -> priceRange', !r.ok && r.errors.price === 'priceRange');
r = L.validateListing(goodForm({ price: '12.5' }));
check('fractional price -> priceRange', !r.ok && r.errors.price === 'priceRange');
r = L.validateListing(goodForm({ seller: '' }));
check('missing seller -> required', !r.ok && r.errors.seller === 'required');
r = L.validateListing(goodForm({ phone: '01234567890' }));
check('bad phone -> phone error', !r.ok && r.errors.phone === 'phone');
r = L.validateListing(goodForm({ notes: 'n'.repeat(301) }));
check('notes 301 chars -> notesLong', !r.ok && r.errors.notes === 'notesLong');
r = L.validateListing(goodForm({ area: 'a'.repeat(81) }));
check('area 81 chars -> areaLong', !r.ok && r.errors.area === 'areaLong');

// --- stored listing guard ---
const stored = { id: 'b1', title: 'T', author: 'A', subject: 'CSE', condition: 'good',
  type: 'sale', price: 100, seller: 'S', phone: '01712345678', area: '', notes: '',
  status: 'available', createdAt: 1700000000000 };
check('stored listing valid', L.isStoredListing(stored));
check('stored listing bad status rejected', !L.isStoredListing(Object.assign({}, stored, { status: 'gone' })));
check('stored listing bad phone rejected', !L.isStoredListing(Object.assign({}, stored, { phone: '123' })));
check('stored listing missing id rejected', !L.isStoredListing(Object.assign({}, stored, { id: '' })));

// --- filtering ---
const listings = [
  Object.assign({}, stored, { id: 'b1', title: 'Data Structures', author: 'Lipschutz', subject: 'CSE', condition: 'good', type: 'sale', price: 350, seller: 'Fahad', phone: '01712345678', status: 'available', createdAt: 1000 }),
  Object.assign({}, stored, { id: 'b2', title: 'Accounting Principles', author: 'Weygandt', subject: 'BBA', condition: 'like-new', type: 'sale', price: 500, seller: 'Rafi', phone: '01812345678', status: 'reserved', createdAt: 2000 }),
  Object.assign({}, stored, { id: 'b3', title: 'English Grammar', author: 'Wren', subject: 'English', condition: 'fair', type: 'free', price: 0, seller: 'Meem', phone: '01912345678', status: 'available', createdAt: 3000 }),
  Object.assign({}, stored, { id: 'b4', title: 'Physics Vol 1', author: 'Halliday', subject: 'Physics', condition: 'worn', type: 'swap', price: 0, seller: 'Fahad', phone: '01512345678', status: 'sold', createdAt: 4000 }),
];
check('filter no opts returns all', L.filterListings(listings, {}).length === 4);
check('filter q title', L.filterListings(listings, { q: 'data' }).length === 1);
check('filter q author case-insensitive', L.filterListings(listings, { q: 'WEYGANDT' }).length === 1);
check('filter q seller', L.filterListings(listings, { q: 'fahad' }).length === 2);
check('filter q no match', L.filterListings(listings, { q: 'zzz' }).length === 0);
check('filter subject CSE', L.filterListings(listings, { subject: 'CSE' }).length === 1);
check('filter condition fair', L.filterListings(listings, { condition: 'fair' }).length === 1);
check('filter type free', L.filterListings(listings, { type: 'free' }).length === 1);
check('filter type swap', L.filterListings(listings, { type: 'swap' }).length === 1);
check('filter status available', L.filterListings(listings, { status: 'available' }).length === 2);
check('filter status sold', L.filterListings(listings, { status: 'sold' }).length === 1);
check('filter maxPrice 300 keeps free+swap only', L.filterListings(listings, { maxPrice: '300' }).length === 2);
check('filter maxPrice 400 keeps 350 + free + swap', L.filterListings(listings, { maxPrice: 400 }).length === 3);
check('filter combined subject+status', L.filterListings(listings, { subject: 'CSE', status: 'available' }).length === 1);
check('filter combined q+type', L.filterListings(listings, { q: 'physics', type: 'swap' }).length === 1);

// --- sorting ---
let s = L.sortListings(listings, 'newest');
check('sort newest first is b4', s[0].id === 'b4' && s[3].id === 'b1');
s = L.sortListings(listings, 'priceAsc');
check('sort priceAsc: 0,0,350,500', s.map((x) => x.price).join(',') === '0,0,350,500');
s = L.sortListings(listings, 'priceDesc');
check('sort priceDesc: 500,350,0,0', s.map((x) => x.price).join(',') === '500,350,0,0');
s = L.sortListings(listings, 'title');
check('sort title A-Z first Accounting', s[0].id === 'b2' && s[3].id === 'b4');
check('sort does not mutate input', listings[0].id === 'b1');

// --- stats ---
let st = L.computeStats(listings);
check('stats total 4', st.total === 4);
check('stats available 2', st.available === 2);
check('stats freeCount 1', st.freeCount === 1);
check('stats avgPrice (350+500)/2 = 425', st.avgPrice === 425, 'got ' + st.avgPrice);
st = L.computeStats([]);
check('stats empty zeros', st.total === 0 && st.avgPrice === 0 && st.saleCount === 0);
st = L.computeStats([listings[2], listings[3]]);
check('stats no sale listings avg 0', st.avgPrice === 0 && st.saleCount === 0);

// --- formatting ---
check('formatMoney 1234567', L.formatMoney(1234567, 'en') === '1,234,567');
check('formatMoney bn digits', L.formatMoney(350, 'bn') === '\u09e9\u09eb\u09e6');
check('toBnDigits 2026', L.toBnDigits('2026') === '\u09e8\u09e6\u09e8\u09ec');
check('priceLabel free', L.priceLabel(listings[2], 'en') === 'free');
check('priceLabel swap', L.priceLabel(listings[3], 'en') === 'swap');
check('priceLabel sale en', L.priceLabel(listings[0], 'en') === '\u09f3' + '350');
check('priceLabel sale bn digits', L.priceLabel(listings[0], 'bn') === '\u09f3' + '\u09e9\u09eb\u09e6');

// --- import/export ---
const exp = L.makeExport(listings, ['b1', 'b3']);
check('export app tag', exp.app === 'book-exchange-bd' && exp.listings.length === 4);
let imp = L.validateImport(exp);
check('import own export ok', imp.ok && imp.listings.length === 4 && imp.wishlist.length === 2);
imp = L.validateImport({ app: 'other-app', listings: [] });
check('import wrong app rejected', !imp.ok && imp.error === 'wrong-app');
imp = L.validateImport({ app: 'book-exchange-bd', listings: 'nope' });
check('import non-array listings rejected', !imp.ok);
imp = L.validateImport({ app: 'book-exchange-bd', listings: [Object.assign({}, stored, { status: 'gone' })] });
check('import bad listing rejected', !imp.ok && imp.error === 'bad-listing');
imp = L.validateImport({ app: 'book-exchange-bd', listings: [stored, stored] });
check('import dup id rejected', !imp.ok && imp.error === 'dup-id');
imp = L.validateImport({ app: 'book-exchange-bd', listings: [stored], wishlist: ['b1', 'missing', 42] });
check('import wishlist filters unknown ids', imp.ok && imp.wishlist.length === 1 && imp.wishlist[0] === 'b1');
imp = L.validateImport(null);
check('import null rejected', !imp.ok);
imp = L.validateImport({ app: 'book-exchange-bd', listings: new Array(501).fill(stored) });
check('import 501 listings rejected', !imp.ok && imp.error === 'too-many');

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
