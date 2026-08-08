# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nav-smoke.spec.ts >> signed-out / mobile Sheet top-level links >> mobile Watch → /feed
- Location: tests/e2e/nav-smoke.spec.ts:237:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:20649/api/dev/logout
Call log:
  - navigating to "http://localhost:20649/api/dev/logout", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * Nav smoke tests — flat top nav + contextual sidebar
  3   |  *
  4   |  * Verifies every route is reachable from at least one nav surface.
  5   |  *
  6   |  * Routes under test:
  7   |  *   /feed, /live, /cinema, /live/replays,
  8   |  *   /studio/portfolio, /studio/storage, /studio/delivery,
  9   |  *   /studio/embeds, /studio/analytics,
  10  |  *   /store, /pricing, /explore?genre=Documentary
  11  |  *
  12  |  * Nav surfaces covered:
  13  |  *   • Desktop top-nav flat links  (viewport ≥1280px)
  14  |  *   • Desktop contextual sidebar  (viewport ≥1280px — lg breakpoint)
  15  |  *   • Mobile Sheet                (viewport 390px)
  16  |  *
  17  |  * data-testid map (artifacts/chroma/src/components/layout.tsx):
  18  |  *
  19  |  *  Desktop top-nav (flat, no dropdowns):
  20  |  *    link-watch      → /feed
  21  |  *    link-live       → /live
  22  |  *    link-studio     → /studio/portfolio  (signed-in only)
  23  |  *    link-shop       → /store
  24  |  *    link-pricing    → /pricing
  25  |  *
  26  |  *  Contextual sidebar (visible at lg when in that section):
  27  |  *    Watch section:
  28  |  *      sidebar-link-feed                   → /feed
  29  |  *      sidebar-link-genre-documentary      → /explore?genre=Documentary
  30  |  *    Live section:
  31  |  *      sidebar-link-streaming              → /live
  32  |  *      sidebar-link-cinema-events          → /cinema
  33  |  *      sidebar-link-replays                → /live/replays
  34  |  *    Studio section (signed-in):
  35  |  *      sidebar-link-portfolio-collections  → /studio/portfolio
  36  |  *      sidebar-link-media-library          → /studio/storage
  37  |  *      sidebar-link-client-delivery        → /studio/delivery
  38  |  *      sidebar-link-website-embedding      → /studio/embeds
  39  |  *      sidebar-link-analytics              → /studio/analytics
  40  |  *
  41  |  *  Mobile sheet top-level links (always visible in drawer):
  42  |  *    mobile-link-watch   → /feed
  43  |  *    mobile-link-live    → /live
  44  |  *    mobile-link-studio  → /studio/portfolio  (signed-in only)
  45  |  *    mobile-link-shop    → /store
  46  |  *    mobile-link-pricing → /pricing
  47  |  *
  48  |  *  Mobile sheet sub-items (only visible when already in that section):
  49  |  *    Live section:
  50  |  *      mobile-link-streaming          → /live
  51  |  *      mobile-link-cinema-events      → /cinema
  52  |  *      mobile-link-replays            → /live/replays
  53  |  *    Studio section (signed-in):
  54  |  *      mobile-link-portfolio-collections → /studio/portfolio
  55  |  *      mobile-link-media-library         → /studio/storage
  56  |  *      mobile-link-client-delivery       → /studio/delivery
  57  |  *      mobile-link-website-embedding     → /studio/embeds
  58  |  *      mobile-link-analytics             → /studio/analytics
  59  |  */
  60  | 
  61  | import { test, expect, type Page } from "@playwright/test";
  62  | 
  63  | // ---------------------------------------------------------------------------
  64  | // Helpers
  65  | // ---------------------------------------------------------------------------
  66  | 
  67  | async function signIn(page: Page) {
  68  |   await page.goto("/api/dev/login");
  69  |   await page.waitForURL(/\//);
  70  | }
  71  | 
  72  | async function signOut(page: Page) {
> 73  |   await page.goto("/api/dev/logout");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:20649/api/dev/logout
  74  |   await page.waitForURL(/\//);
  75  | }
  76  | 
  77  | /** Click a top-nav flat link. */
  78  | async function clickTopNav(page: Page, testid: string) {
  79  |   await page.click(`[data-testid="${testid}"]`);
  80  | }
  81  | 
  82  | /** Open mobile sheet and click an item. */
  83  | async function clickMobileSheetItem(page: Page, itemTestId: string) {
  84  |   await page.getByTestId("btn-mobile-menu").click();
  85  |   const link = page.getByTestId(itemTestId);
  86  |   await link.waitFor({ state: "visible" });
  87  |   await link.click();
  88  | }
  89  | 
  90  | // ---------------------------------------------------------------------------
  91  | // Signed-out: top-nav flat links (desktop)
  92  | // ---------------------------------------------------------------------------
  93  | 
  94  | test.describe("signed-out / top-nav flat links (desktop)", () => {
  95  |   test.use({ viewport: { width: 1280, height: 800 } });
  96  | 
  97  |   test.beforeEach(async ({ page }) => {
  98  |     await signOut(page);
  99  |     await page.goto("/");
  100 |   });
  101 | 
  102 |   test("Watch link → /feed", async ({ page }) => {
  103 |     await clickTopNav(page, "link-watch");
  104 |     await expect(page).toHaveURL(/\/feed/);
  105 |   });
  106 | 
  107 |   test("Live link → /live", async ({ page }) => {
  108 |     await clickTopNav(page, "link-live");
  109 |     await expect(page).toHaveURL(/\/live($|[^/])/);
  110 |   });
  111 | 
  112 |   test("Shop link → /store", async ({ page }) => {
  113 |     await clickTopNav(page, "link-shop");
  114 |     await expect(page).toHaveURL(/\/store/);
  115 |   });
  116 | 
  117 |   test("Pricing link → /pricing", async ({ page }) => {
  118 |     await clickTopNav(page, "link-pricing");
  119 |     await expect(page).toHaveURL(/\/pricing/);
  120 |   });
  121 | });
  122 | 
  123 | // ---------------------------------------------------------------------------
  124 | // Signed-in: top-nav flat links (desktop)
  125 | // ---------------------------------------------------------------------------
  126 | 
  127 | test.describe("signed-in / top-nav flat links (desktop)", () => {
  128 |   test.use({ viewport: { width: 1280, height: 800 } });
  129 | 
  130 |   test.beforeEach(async ({ page }) => {
  131 |     await signIn(page);
  132 |     await page.goto("/");
  133 |   });
  134 | 
  135 |   test("Watch link → /feed", async ({ page }) => {
  136 |     await clickTopNav(page, "link-watch");
  137 |     await expect(page).toHaveURL(/\/feed/);
  138 |   });
  139 | 
  140 |   test("Studio link → /studio/portfolio", async ({ page }) => {
  141 |     await clickTopNav(page, "link-studio");
  142 |     await expect(page).toHaveURL(/\/studio\/portfolio/);
  143 |   });
  144 | });
  145 | 
  146 | // ---------------------------------------------------------------------------
  147 | // Signed-out: contextual sidebar (desktop)
  148 | // Navigate to a section first so its sidebar appears, then click sub-items.
  149 | // ---------------------------------------------------------------------------
  150 | 
  151 | test.describe("signed-out / contextual sidebar (desktop)", () => {
  152 |   test.use({ viewport: { width: 1280, height: 800 } });
  153 | 
  154 |   test.beforeEach(async ({ page }) => {
  155 |     await signOut(page);
  156 |   });
  157 | 
  158 |   test("Watch sidebar: /feed via sidebar-link-feed", async ({ page }) => {
  159 |     await page.goto("/feed");
  160 |     await page.getByTestId("sidebar-link-feed").click();
  161 |     await expect(page).toHaveURL(/\/feed/);
  162 |   });
  163 | 
  164 |   test("Watch sidebar: genre link → /explore?genre=Documentary", async ({ page }) => {
  165 |     await page.goto("/feed");
  166 |     await page.getByTestId("sidebar-link-genre-documentary").click();
  167 |     await expect(page).toHaveURL(/\/explore/);
  168 |   });
  169 | 
  170 |   test("Live sidebar: /cinema via sidebar-link-cinema-events", async ({ page }) => {
  171 |     await page.goto("/live");
  172 |     await page.getByTestId("sidebar-link-cinema-events").click();
  173 |     await expect(page).toHaveURL(/\/cinema/);
```