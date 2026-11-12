// book-exchange-bd -- DOM app. Depends on js/logic.js + js/i18n.js (loaded first).
(function () {
  'use strict';
  var L = window.BookExchangeLogic;
  var LANG_KEY = 'book-exchange-bd-lang';

  var state = { listings: [], wishlist: [] };
  var lang = 'en';
  var editingId = null;

  function $(id) { return document.getElementById(id); }
  function t(key) {
    var d = (window.I18N && window.I18N[lang]) || {};
    return d[key] != null ? d[key] : (window.I18N.en[key] || key);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtMoney(n) { return L.formatMoney(n, lang); }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return new Date(ts).toDateString(); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(L.APP_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && Array.isArray(data.listings)) {
        state.listings = data.listings.filter(L.isStoredListing);
      }
      if (data && Array.isArray(data.wishlist)) {
        var ids = {};
        state.listings.forEach(function (l) { ids[l.id] = true; });
        state.wishlist = data.wishlist.filter(function (id) { return ids[id]; });
      }
    } catch (e) { state = { listings: [], wishlist: [] }; }
    try {
      var savedLang = localStorage.getItem(LANG_KEY);
      if (savedLang === 'bn' || savedLang === 'en') lang = savedLang;
    } catch (e) { /* ignore */ }
  }
  function save() {
    try { localStorage.setItem(L.APP_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function saveLang() {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  }

  function buildSelectOptions(sel, items, allLabel, labelFn) {
    sel.innerHTML = '';
    var optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = allLabel;
    sel.appendChild(optAll);
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it;
      o.textContent = labelFn(it);
      sel.appendChild(o);
    });
  }
  function buildFormSelects() {
    buildSelectOptions($('fSubject'), L.SUBJECTS, t('filterAll'), function (s) { return t('subj_' + s); });
    buildSelectOptions($('fCondition'), L.CONDITIONS, t('filterAll'), function (c) { return t('cond_' + c); });
    buildSelectOptions($('fType'), L.TYPES, t('filterAll'), function (y) {
      return y === 'sale' ? t('forSale') : y === 'free' ? t('giveaway') : t('swap');
    });
    buildSelectOptions($('fStatus'), L.STATUSES, t('filterAll'), function (s) { return t('status_' + s); });
    var fs = $('subject');
    fs.innerHTML = '';
    L.SUBJECTS.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = t('subj_' + s);
      fs.appendChild(o);
    });
    var fc = $('condition');
    fc.innerHTML = '';
    L.CONDITIONS.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = t('cond_' + c);
      fc.appendChild(o);
    });
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    $('langEn').classList.toggle('active', lang === 'en');
    $('langBn').classList.toggle('active', lang === 'bn');
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    buildFormSelects();
    $('formTitle').textContent = editingId ? t('editTitle') : t('postTitle');
    $('saveBtn').textContent = editingId ? t('saveEditBtn') : t('saveBtn');
    render();
  }

  function currentFilters() {
    return {
      q: $('q').value,
      subject: $('fSubject').value,
      condition: $('fCondition').value,
      type: $('fType').value,
      status: $('fStatus').value,
      maxPrice: $('fMaxPrice').value
    };
  }

  function priceText(l) {
    var pl = L.priceLabel(l, lang);
    if (pl === 'free') return t('free');
    if (pl === 'swap') return t('swap');
    return pl;
  }

  function cardHtml(l) {
    var wished = state.wishlist.indexOf(l.id) !== -1;
    var typeLabel = l.type === 'sale' ? t('forSale') : l.type === 'free' ? t('giveaway') : t('swap');
    var statusBtn = '';
    if (l.status === 'available') {
      statusBtn = '<button class="btn small" data-act="reserve" data-id="' + l.id + '">' + esc(t('markReserved')) + '</button>' +
        '<button class="btn small" data-act="sold" data-id="' + l.id + '">' + esc(t('markSold')) + '</button>';
    } else if (l.status === 'reserved') {
      statusBtn = '<button class="btn small" data-act="sold" data-id="' + l.id + '">' + esc(t('markSold')) + '</button>' +
        '<button class="btn small" data-act="available" data-id="' + l.id + '">' + esc(t('markAvailable')) + '</button>';
    } else {
      statusBtn = '<button class="btn small" data-act="available" data-id="' + l.id + '">' + esc(t('markAvailable')) + '</button>';
    }
    return '<article class="card" data-id="' + esc(l.id) + '">' +
      '<div class="card-top"><h3>' + esc(l.title) + '</h3>' +
      '<button class="heart' + (wished ? ' on' : '') + '" data-act="wish" data-id="' + l.id + '" title="' + esc(wished ? t('wishlistRemove') : t('wishlistAdd')) + '" aria-label="' + esc(wished ? t('wishlistRemove') : t('wishlistAdd')) + '">' + (wished ? '\u2665' : '\u2661') + '</button></div>' +
      '<p class="author">' + esc(l.author) + '</p>' +
      '<p class="badges"><span class="badge">' + esc(t('subj_' + l.subject)) + '</span>' +
      '<span class="badge">' + esc(t('cond_' + l.condition)) + '</span>' +
      '<span class="badge">' + esc(typeLabel) + '</span>' +
      '<span class="badge status-' + l.status + '">' + esc(t('status_' + l.status)) + '</span></p>' +
      '<p class="price">' + esc(priceText(l)) + '</p>' +
      '<p class="meta">' + esc(t('sellerLabel')) + ': ' + esc(l.seller) +
      ' &middot; <a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a>' +
      (l.area ? ' &middot; ' + esc(l.area) : '') + '</p>' +
      (l.notes ? '<p class="notes">' + esc(l.notes) + '</p>' : '') +
      '<p class="meta dim">' + esc(t('postedLabel')) + ': ' + esc(fmtDate(l.createdAt)) + '</p>' +
      '<div class="actions">' + statusBtn +
      '<button class="btn small" data-act="edit" data-id="' + l.id + '">' + esc(t('editBtn')) + '</button>' +
      '<button class="btn small danger" data-act="delete" data-id="' + l.id + '">' + esc(t('deleteBtn')) + '</button></div>' +
      '</article>';
  }

  function render() {
    var stats = L.computeStats(state.listings);
    $('statTotal').textContent = lang === 'bn' ? L.toBnDigits(stats.total) : stats.total;
    $('statAvailable').textContent = lang === 'bn' ? L.toBnDigits(stats.available) : stats.available;
    $('statFree').textContent = lang === 'bn' ? L.toBnDigits(stats.freeCount) : stats.freeCount;
    $('statAvg').textContent = stats.saleCount ? '\u09f3' + fmtMoney(stats.avgPrice) : '\u2014';

    var filtered = L.sortListings(
      L.filterListings(state.listings, currentFilters()), $('sort').value);
    var listEl = $('list');
    listEl.innerHTML = filtered.map(cardHtml).join('');
    $('listEmpty').style.display = filtered.length ? 'none' : 'block';

    var wished = state.listings.filter(function (l) { return state.wishlist.indexOf(l.id) !== -1; });
    $('wishCount').textContent = lang === 'bn' ? L.toBnDigits(wished.length) : wished.length;
    $('wishList').innerHTML = wished.map(cardHtml).join('');
    $('wishEmpty').style.display = wished.length ? 'none' : 'block';
  }

  function showTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
  }

  function setError(field, code) {
    var el = $('err-' + field);
    if (el) el.textContent = code ? t('err_' + code) : '';
  }
  function clearErrors() {
    ['title', 'author', 'subject', 'condition', 'type', 'price', 'seller', 'phone', 'area', 'notes']
      .forEach(function (f) { setError(f, null); });
  }

  function fillForm(l) {
    $('title').value = l.title;
    $('author').value = l.author;
    $('subject').value = l.subject;
    $('condition').value = l.condition;
    document.querySelector('input[name="type"][value="' + l.type + '"]').checked = true;
    $('price').value = l.price || '';
    $('seller').value = l.seller;
    $('phone').value = l.phone;
    $('area').value = l.area || '';
    $('notes').value = l.notes || '';
  }
  function resetForm() {
    editingId = null;
    $('postForm').reset();
    $('formTitle').textContent = t('postTitle');
    $('saveBtn').textContent = t('saveBtn');
    $('cancelEdit').style.display = 'none';
    $('formMsg').textContent = '';
    clearErrors();
  }

  function findListing(id) {
    for (var i = 0; i < state.listings.length; i++) {
      if (state.listings[i].id === id) return state.listings[i];
    }
    return null;
  }

  function onCardAction(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    var l = findListing(id);
    if (!l && act !== 'wish') return;
    if (act === 'wish') {
      var i = state.wishlist.indexOf(id);
      if (i === -1) state.wishlist.push(id); else state.wishlist.splice(i, 1);
      save(); render();
    } else if (act === 'reserve' || act === 'sold' || act === 'available') {
      l.status = act === 'reserve' ? 'reserved' : act === 'sold' ? 'sold' : 'available';
      save(); render();
    } else if (act === 'edit') {
      editingId = id;
      fillForm(l);
      $('formTitle').textContent = t('editTitle');
      $('saveBtn').textContent = t('saveEditBtn');
      $('cancelEdit').style.display = 'inline-block';
      $('formMsg').textContent = '';
      clearErrors();
      showTab('post');
      window.scrollTo(0, 0);
    } else if (act === 'delete') {
      if (window.confirm(t('confirmDelete'))) {
        state.listings = state.listings.filter(function (x) { return x.id !== id; });
        state.wishlist = state.wishlist.filter(function (x) { return x !== id; });
        save(); render();
        $('formMsg').textContent = '';
      }
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    var typeEl = document.querySelector('input[name="type"]:checked');
    var form = {
      title: $('title').value,
      author: $('author').value,
      subject: $('subject').value,
      condition: $('condition').value,
      type: typeEl ? typeEl.value : '',
      price: $('price').value,
      seller: $('seller').value,
      phone: $('phone').value,
      area: $('area').value,
      notes: $('notes').value
    };
    var res = L.validateListing(form);
    clearErrors();
    if (!res.ok) {
      Object.keys(res.errors).forEach(function (f) { setError(f, res.errors[f]); });
      return;
    }
    var msgKey = editingId ? 'updatedMsg' : 'postedMsg';
    if (editingId) {
      var l = findListing(editingId);
      if (l) {
        Object.keys(res.value).forEach(function (k) { l[k] = res.value[k]; });
      }
    } else {
      var now = Date.now();
      var nl = { id: 'b' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36),
        createdAt: now, status: 'available' };
      Object.keys(res.value).forEach(function (k) { nl[k] = res.value[k]; });
      state.listings.push(nl);
    }
    save();
    var wasEdit = !!editingId;
    resetForm();
    $('formMsg').textContent = t(msgKey);
    render();
    if (!wasEdit) showTab('browse');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function bind() {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
    });
    $('langEn').addEventListener('click', function () { lang = 'en'; saveLang(); applyI18n(); });
    $('langBn').addEventListener('click', function () { lang = 'bn'; saveLang(); applyI18n(); });
    ['q', 'fSubject', 'fCondition', 'fType', 'fStatus', 'fMaxPrice', 'sort'].forEach(function (id) {
      $(id).addEventListener('input', render);
      $(id).addEventListener('change', render);
    });
    $('list').addEventListener('click', onCardAction);
    $('wishList').addEventListener('click', onCardAction);
    $('postForm').addEventListener('submit', onSubmit);
    $('cancelEdit').addEventListener('click', resetForm);
    $('exportBtn').addEventListener('click', function () {
      download('book-exchange-bd-export.json',
        JSON.stringify(L.makeExport(state.listings, state.wishlist), null, 2));
    });
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var msg = $('dataMsg');
        try {
          var res = L.validateImport(JSON.parse(reader.result));
          if (!res.ok) { msg.textContent = t('importBad'); return; }
          state.listings = res.listings;
          state.wishlist = res.wishlist || [];
          save(); render();
          msg.textContent = t('importOk').replace('{n}',
            lang === 'bn' ? L.toBnDigits(res.listings.length) : res.listings.length);
        } catch (err) { msg.textContent = t('importBad'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseConfirm').value.trim() !== 'DELETE') {
        $('dataMsg').textContent = t('eraseConfirm');
        return;
      }
      state = { listings: [], wishlist: [] };
      save();
      $('eraseConfirm').value = '';
      $('dataMsg').textContent = t('erasedMsg');
      render();
    });
  }

  load();
  bind();
  applyI18n();

  // Test hooks (used by tests/smoke.js; harmless in production).
  window.__bx = {
    get state() { return state; },
    get lang() { return lang; },
    exportPayload: function () { return JSON.stringify(L.makeExport(state.listings, state.wishlist)); },
    importPayload: function (text) {
      try {
        var res = L.validateImport(JSON.parse(text));
        if (!res.ok) return { ok: false, error: res.error };
        state.listings = res.listings;
        state.wishlist = res.wishlist || [];
        save(); render();
        return { ok: true, count: res.listings.length };
      } catch (e) { return { ok: false, error: 'parse' }; }
    },
    eraseAll: function () { state = { listings: [], wishlist: [] }; save(); render(); }
  };
})();
