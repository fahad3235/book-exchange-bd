# Book Exchange BD

A 100% offline, bilingual (English / বাংলা) second-hand book exchange board for
students in Bangladesh. Post a book you no longer need, browse what others are
offering, save favourites, and arrange a swap, a free giveaway, or a sale —
without any account, server, or internet connection. All data lives in the
browser (localStorage).

## Problem

Textbooks and course books are expensive, and every semester students end up
with books they no longer need while classmates hunt for the same titles.
Facebook groups work, but posts sink within hours, there is no structured
search by subject or price, and nothing tracks whether a book is still
available. Book Exchange BD is a small, focused notice board that fixes that:
structured listings, search and filters, availability status, and a wishlist —
all offline.

## Features

- **Post a book** — title, author, subject/course (14 subjects), condition
  (Like new / Good / Fair / Worn), listing type (For sale / Free giveaway /
  Swap), asking price, seller name, Bangladeshi mobile, area/campus, notes.
  Inline validation: required fields, title/author/name length caps, price
  0–1,000,000 Tk, sale listings must have a price above 0, free/swap listings
  carry no price, phone must be a valid Bangladeshi mobile
  (`01[3-9]XXXXXXXX`, dashes/spaces/`+880` accepted and normalised).
- **Browse & search** — live search across title, author, seller and area,
  plus filters for subject, condition, type, status, and max price.
- **Sort** — newest first, price low→high, price high→low, title A–Z.
- **Availability pipeline** — Available → Reserved → Sold, with one-tap status
  buttons on every card; sold/reserved books stay visible so the board is an
  honest record, not a disappearing feed.
- **Wishlist** — heart any listing to save it; the wishlist tab and the tab
  badge count persist across reloads.
- **Stats dashboard** — total listings, available now, free books, average
  asking price (sale listings only).
- **Data tools** — JSON export, strict JSON import (wrong app, bad listing,
  duplicate id, or >500 listings all rejected with data left intact), and
  typed-`DELETE` erase-all.
- **Bilingual** — full English / বাংলা toggle, persisted across reloads, with
  Bengali digits for prices and counts in বাংলা mode.
- **Offline & private** — zero network requests; nothing leaves the device.
  Ships empty — no demo listings, no fabricated data.

## Stack

Vanilla HTML + CSS + JavaScript. No frameworks, no build step, no external
assets. Pure-ASCII source files (Bengali strings live as `\uXXXX` escapes in
`js/i18n.js`, generated from `tools/gen_i18n.py`, so the GitHub push transport
cannot corrupt them).

## Prerequisites

Any modern browser. For the tests: Node.js 18+ and a headless Chromium
(`headless_shell`, as shipped with Playwright's Chromium builds).

## Install & run

```bash
# No install step. Open the file directly, or serve it:
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Dev commands

```bash
node tests/logic.test.js   # 79 unit checks for js/logic.js
node tests/smoke.js        # 83 headless-Chrome smoke checks (raw CDP, file://)
python3 tools/gen_i18n.py # regenerate js/i18n.js from tools/gen_i18n.py (source of truth)
```

## Environment

No environment variables, no keys, no backend. Language choice is stored in
`localStorage` under `book-exchange-bd-lang`; listings under
`book-exchange-bd-v1`.

## Testing

See [`TEST_RESULTS.md`](TEST_RESULTS.md): 79/79 unit checks and 83/83
headless-Chrome smoke checks green, 0 console/page errors, 390px mobile
verified with no horizontal overflow on any tab, zero non-file network
requests.

## Deployment

Static site — copy the repo to any static host, or enable GitHub Pages
(main branch, `/` root). No build step.

## Limitations

- **Local only:** listings live in one browser on one device. There is no
  shared marketplace, no accounts, and no way for two phones to see each
  other's books. Export/import JSON is the way to move data between devices.
- **No payments, no delivery:** the app never handles money. Meet in a public
  place, check the book before paying, never pay in advance.
- **No identity verification:** seller names and phone numbers are
  self-reported; the phone check only validates the number format.
- **Price is an asking price:** the app does not value books and does not
  check whether a price is fair.

## Status

Complete MVP, tested and published. See the ledger entry for this run's
verification evidence.
