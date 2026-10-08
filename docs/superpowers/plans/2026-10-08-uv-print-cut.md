# UV-печать и резка — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Work in the existing feature checkout; retain the served `web` preview.

**Goal:** Complete the category and nine UV service pages using Еговерсия2 content and calculators, preserving the current site's appearance.
**Architecture:** Reuse the established service page template and shared cart. Use the existing safe Excel evaluator with six source books; isolate UV validation, sharing and page interactions.
**Tech Stack:** Static HTML/CSS, browser JavaScript, Python page generator, Node tests, Playwright.
**Spec:** User request of 08.10.2026 and the accepted wide-format service template.

## Global Constraints

- Obtain origin/main first; preserve feature work and local user files. Never push main.
- Preserve current main header, buttons, FAQ, footer and frameless SEO.
- Content, artwork, formulas and dependent options come from Еговерсия2. Exclude editorial directions.
- Retain current company content, consent flow, shared cart, PDF quotes and deployment prefix support.

## Review Focus

- Material changes invalidate thickness/application choices: normalize dependent fields before quote.
- Metal printing accepts only metal; wardrobe numbers always have no keychain hardware.
- Quantities, dimensions and fill must respect source limits; invalid quotes cannot enter the cart.
- Shared workbook minimums apply once across compatible services, including wide plotter cutting.
- Shared links, cart editing, files and manual requests must preserve every selected parameter.

### Task 1: Integrate latest main

- [x] Fetch main 666f52d and merge into existing feature, retaining the wide-format pages.
- [x] Resolve shared imports/navigation/request prefill; rebuild existing wide pages with the current header.
- [x] Run static page/SEO validation; preserve main's articles and legal components.

### Task 2: UV pricing and sharing

Create `uv-services.js`, `uv-pricing-data.js`, `uv-pricing.js`, `uv-sharing.js`.
Interfaces: `TEXT_UV_PRICING.{defaults,normalize,fields,quote}`, `TEXT_UV_SHARING.{read,url,text,description}`.

- [x] Generate independent expected cases using the source engine and six books.
- [x] Write pricing/sharing tests and observe failure before implementation.
- [x] Implement exact workbook formulas, dependent lists and service restrictions.
- [x] Test all option families, boundaries, minimums, selected URL round trips and mixed carts.

### Task 3: Pages and calculator interface

Create `uv-content.json`, `uv-print-cut.js`, `uv-print-cut.css`, `scripts/build-uv-pages.py` and ten pages.
Modify shared navigation/imports/cart minimum labels and company generator section list.

- [x] Adapt nine service texts, FAQs, requirements, related articles and source artwork.
- [x] Build category and service pages from the current shared shell.
- [x] Integrate live options, quantity comparisons, copy/download, files, cart editing and manual request.
- [x] Apply current SEO to all routes without changing visible design.

### Task 4: Verification and delivery

- [x] Run UV tests, existing pricing/cart/consent regressions, static page and SEO checks.
- [x] Verify nine browser flows, mobile widths, navigation and deployment prefixes; inspect screenshots.
- [x] Obtain one fresh read-only whole-change review; fix substantive findings with regression checks.
- [x] Synchronize the feature checkout and deliver the working local preview.
