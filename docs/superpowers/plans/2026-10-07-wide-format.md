# Wide format implementation plan

> Implement inline with superpowers:executing-plans; one final review after integration.

**Goal:** Complete the nine wide-format services and their category using current main styling and updated Еговерсия2 content plus SEO_cloude.xlsx metadata.

**Architecture:** Static pages reuse the shared homepage header/footer and sticker service layout. A separate configuration, pricing module and form controller implement the seven supplied wide-format calculation models. Global routes and the existing cart continue working on every page.

**Tech stack:** Vanilla JavaScript, HTML/CSS, Node tests and browser checks, standard-library Python page generation.

**Spec:** User request of 2026-10-07: latest main first; all of «Широкий формат»; updated source content combined with our existing visual style.

## Global constraints

- Baseline: main ddabd84. Work on feature/stickerpacks-page-2026-10-05; never push main.
- Nine services 5.1–5.9; independent content, FAQ, canonical, metadata and links.
- Use current header, footer, buttons, FAQ, calculator and frameless SEO layout.
- Source materials, size limits, price interpolation, rounding and minimum checks remain faithful to the supplied models.
- Capacity: 7,000 ₽ per working day after full artwork approval; estimate, not a promised calendar date.
- No source editorial directives in customer-facing text. No automatic file transmission.
- Preserve company content and all existing sticker services.

## Review focus

- Area tariffs must use total area and preserve workbook rounding.
- Print/material dependencies and invalid dimensions cannot yield an orderable quote.
- Quantity extrapolation can turn source mounting prices negative: report manual calculation rather than sell a negative or fabricated price.
- Shared URLs and cart editing restore all selected options and dimensions.
- Cart minima apply per calculation book, including poster/plakat and auto/glass shared groups.

## Task 1: Calculation models

Files: wide-format-services.js, wide-format-pricing.js, wide-format-calculator.js; tests/wide-format-cases.json and wide-format.test.mjs.

Interface: TEXT_QUOTE_WIDE_SERVICE(id, configuration) → {unit,subtotal,total,surcharge,effectiveUnit,days,...} or null.

- [x] Fetch main and fast-forward current feature branch; sync preview, retain backups of local differences.
- [x] Inspect all source categories, services, technical profiles, calculator schemas and current SEO workbook.
- [x] Generate independent expected cases with the source workbook evaluator; run failing tests before implementing.
- [x] Implement area, plotter and mounting families with exact book rates and validations; pass 3,564 fixture cases. Mounting uses raw quantity interpolation internally, as the workbook does.

## Task 2: Pages and form

Files: wide-format-content.json, scripts/build-wide-format-pages.py, wide-format.js, wide-format-sharing.js, wide-format.css; shirokiy-format/**/index.html.

- [x] Reuse current page template; create nine service pages plus category, supplied illustrations, service-specific requirements and articles.
- [x] Wire option dependencies, dimensions, price ladder, copy URL, artwork storage, cart editing and quote download.
- [x] Test shared links, malformed inputs and form state transitions.

## Task 3: Navigation and cart

Files: app.js, stickerpack-calculator.js, existing HTML script imports, scripts/build-company-pages.py.

- [x] Connect menu, search and catalog to new static routes; load shared config and minima on every page.
- [x] Test mixed orders and minima once per book; preserve sticker regressions.

## Task 4: Verification and delivery

- [x] Run math/sharing regression tests and complete local link/metadata checks.
- [x] Check all new routes on desktop/mobile, under a deployment prefix, and file/cart flows.
- [x] One final review; fix the manual-request context loss with a red/green browser test; repeat affected checks.
- [x] Sync verified changes to the existing feature checkout and keep the local preview available.

Delivery: commit and push the existing feature branch after verification; do not push main. The actual delivery revision is recorded in Git.
