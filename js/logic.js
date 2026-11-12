// book-exchange-bd -- pure logic (no DOM). Node-testable.
// All strings here are ASCII; user-facing text lives in js/i18n.js.
(function (root) {
  'use strict';

  var SUBJECTS = ['CSE', 'EEE', 'BBA', 'English', 'Bangla', 'Math', 'Physics',
    'Chemistry', 'Biology', 'Economics', 'Accounting', 'Law', 'Medicine', 'Other'];
  var CONDITIONS = ['like-new', 'good', 'fair', 'worn'];
  var TYPES = ['sale', 'free', 'swap'];
  var STATUSES = ['available', 'reserved', 'sold'];
  var MAX_PRICE = 1000000;
  var APP_KEY = 'book-exchange-bd-v1';
  var EXPORT_APP = 'book-exchange-bd';

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
    '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function formatMoney(n, lang) {
    var s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  // Normalise a Bangladeshi mobile: strip spaces/dashes, accept +880 prefix.
  function normalizePhone(raw) {
    if (raw == null) return '';
    var s = String(raw).replace(/[\s\-()]/g, '');
    if (s.indexOf('+880') === 0) s = '0' + s.slice(4);
    if (s.indexOf('880') === 0 && s.length === 13) s = '0' + s.slice(3);
    return s;
  }

  function isValidPhone(raw) {
    return /^01[3-9]\d{8}$/.test(normalizePhone(raw));
  }

  // Validate one listing form object. Returns {ok, errors, value}.
  // value is the cleaned listing (without id/createdAt/status).
  function validateListing(f) {
    var errors = {};
    var v = {};
    var title = String(f.title || '').trim();
    if (!title) errors.title = 'required';
    else if (title.length > 120) errors.title = 'titleLong';
    else v.title = title;

    var author = String(f.author || '').trim();
    if (!author) errors.author = 'required';
    else if (author.length > 80) errors.author = 'authorLong';
    else v.author = author;

    if (SUBJECTS.indexOf(f.subject) === -1) errors.subject = 'required';
    else v.subject = f.subject;

    if (CONDITIONS.indexOf(f.condition) === -1) errors.condition = 'required';
    else v.condition = f.condition;

    if (TYPES.indexOf(f.type) === -1) errors.type = 'required';
    else v.type = f.type;

    var priceRaw = f.price;
    var price = priceRaw === '' || priceRaw == null ? 0 : Number(priceRaw);
    if (isNaN(price) || !isFinite(price) || Math.floor(price) !== price) {
      errors.price = 'priceRange';
    } else if (price < 0 || price > MAX_PRICE) {
      errors.price = 'priceRange';
    } else if (v.type === 'sale' && price <= 0) {
      errors.price = 'price';
    } else if ((v.type === 'free' || v.type === 'swap') && price !== 0) {
      // Free/swap listings carry no price; normalise to 0.
      price = 0;
    }
    v.price = price;

    var seller = String(f.seller || '').trim();
    if (!seller) errors.seller = 'required';
    else if (seller.length > 60) errors.seller = 'nameLong';
    else v.seller = seller;

    var phone = normalizePhone(f.phone);
    if (!isValidPhone(f.phone)) errors.phone = 'phone';
    else v.phone = phone;

    var area = String(f.area || '').trim();
    if (area.length > 80) errors.area = 'areaLong';
    else v.area = area;

    var notes = String(f.notes || '').trim();
    if (notes.length > 300) errors.notes = 'notesLong';
    else v.notes = notes;

    return { ok: Object.keys(errors).length === 0, errors: errors, value: v };
  }

  function isStoredListing(o) {
    if (!o || typeof o !== 'object') return false;
    if (typeof o.id !== 'string' || !o.id) return false;
    if (typeof o.title !== 'string' || !o.title) return false;
    if (typeof o.author !== 'string' || !o.author) return false;
    if (SUBJECTS.indexOf(o.subject) === -1) return false;
    if (CONDITIONS.indexOf(o.condition) === -1) return false;
    if (TYPES.indexOf(o.type) === -1) return false;
    if (STATUSES.indexOf(o.status) === -1) return false;
    if (typeof o.price !== 'number' || o.price < 0 || o.price > MAX_PRICE) return false;
    if (typeof o.seller !== 'string' || !o.seller) return false;
    if (!isValidPhone(o.phone)) return false;
    if (typeof o.createdAt !== 'number') return false;
    return true;
  }

  // Filter listings. opts: {q, subject, condition, type, status, maxPrice}
  function filterListings(listings, opts) {
    opts = opts || {};
    var q = String(opts.q || '').trim().toLowerCase();
    var maxPrice = opts.maxPrice === '' || opts.maxPrice == null
      ? null : Number(opts.maxPrice);
    return listings.filter(function (l) {
      if (q) {
        var hay = (l.title + ' ' + l.author + ' ' + l.seller + ' ' +
          (l.area || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (opts.subject && opts.subject !== 'all' && l.subject !== opts.subject) return false;
      if (opts.condition && opts.condition !== 'all' && l.condition !== opts.condition) return false;
      if (opts.type && opts.type !== 'all' && l.type !== opts.type) return false;
      if (opts.status && opts.status !== 'all' && l.status !== opts.status) return false;
      if (maxPrice != null && !isNaN(maxPrice) && l.price > maxPrice) return false;
      return true;
    });
  }

  // sortKey: 'newest' | 'priceAsc' | 'priceDesc' | 'title'
  function sortListings(listings, sortKey) {
    var out = listings.slice();
    if (sortKey === 'priceAsc') {
      out.sort(function (a, b) { return (a.price - b.price) || (b.createdAt - a.createdAt); });
    } else if (sortKey === 'priceDesc') {
      out.sort(function (a, b) { return (b.price - a.price) || (b.createdAt - a.createdAt); });
    } else if (sortKey === 'title') {
      out.sort(function (a, b) {
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      });
    } else {
      out.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
    return out;
  }

  function computeStats(listings) {
    var total = listings.length;
    var available = 0, freeCount = 0, saleSum = 0, saleCount = 0;
    listings.forEach(function (l) {
      if (l.status === 'available') available++;
      if (l.type === 'free' && l.status === 'available') freeCount++;
      if (l.type === 'sale') { saleSum += l.price; saleCount++; }
    });
    return {
      total: total,
      available: available,
      freeCount: freeCount,
      avgPrice: saleCount ? Math.round(saleSum / saleCount) : 0,
      saleCount: saleCount
    };
  }

  function priceLabel(l, lang) {
    if (l.type === 'free') return 'free';
    if (l.type === 'swap') return 'swap';
    return '\u09f3' + formatMoney(l.price, lang);
  }

  // Validate an imported JSON payload. Returns {ok, listings, error}.
  function validateImport(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'bad-shape' };
    if (data.app !== EXPORT_APP) return { ok: false, error: 'wrong-app' };
    if (!Array.isArray(data.listings)) return { ok: false, error: 'bad-shape' };
    if (data.listings.length > 500) return { ok: false, error: 'too-many' };
    var seen = {};
    for (var i = 0; i < data.listings.length; i++) {
      var l = data.listings[i];
      if (!isStoredListing(l)) return { ok: false, error: 'bad-listing', index: i };
      if (seen[l.id]) return { ok: false, error: 'dup-id', index: i };
      seen[l.id] = true;
    }
    var wishlist = Array.isArray(data.wishlist) ? data.wishlist.filter(function (id) {
      return typeof id === 'string' && seen[id];
    }) : [];
    return { ok: true, listings: data.listings, wishlist: wishlist };
  }

  function makeExport(listings, wishlist) {
    return { app: EXPORT_APP, version: 1, exportedAt: new Date().toISOString(),
      listings: listings, wishlist: wishlist };
  }

  var api = {
    SUBJECTS: SUBJECTS, CONDITIONS: CONDITIONS, TYPES: TYPES, STATUSES: STATUSES,
    MAX_PRICE: MAX_PRICE, APP_KEY: APP_KEY, EXPORT_APP: EXPORT_APP,
    toBnDigits: toBnDigits, formatMoney: formatMoney,
    normalizePhone: normalizePhone, isValidPhone: isValidPhone,
    validateListing: validateListing, isStoredListing: isStoredListing,
    filterListings: filterListings, sortListings: sortListings,
    computeStats: computeStats, priceLabel: priceLabel,
    validateImport: validateImport, makeExport: makeExport
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BookExchangeLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
