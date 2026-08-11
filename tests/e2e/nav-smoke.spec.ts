/**
 * Nav smoke tests — flat top nav + contextual sidebar
 *
 * Verifies every route is reachable from at least one nav surface.
 *
 * Routes under test:
 *   /feed, /live, /cinema, /live/replays,
 *   /studio/portfolio, /studio/storage, /studio/delivery,
 *   /studio/embeds, /studio/analytics,
 *   /community, /pricing, /explore?genre=Documentary
 *
 * Nav surfaces covered:
 *   • Desktop top-nav flat links  (viewport ≥1280px)
 *   • Desktop contextual sidebar  (viewport ≥1280px — lg breakpoint)
 *   • Mobile Sheet                (viewport 390px)
 *
 * data-testid map (artifacts/chroma/src/components/layout.tsx):
 *
 *  Desktop top-nav (flat, no dropdowns):
 *    link-watch      → /feed
 *    link-live       → /live
 *    link-studio     → /studio/portfolio  (signed-in only)
 *    link-community  → /community
 *    link-pricing    → /pricing
 *
 *  Contextual sidebar (visible at lg when in that section):
 *    Watch section:
 *      sidebar-link-feed                   → /feed
 *      sidebar-link-genre-documentary      → /explore?genre=Documentary
 *    Live section:
 *      sidebar-link-streaming              → /live
 *      sidebar-link-cinema-events          → /cinema
 *      sidebar-link-replays                → /live/replays
 *    Studio section (signed-in):
 *      sidebar-link-portfolio-collections  → /studio/portfolio
 *      sidebar-link-media-library          → /studio/storage
 *      sidebar-link-client-delivery        → /studio/delivery
 *      sidebar-link-website-embedding      → /studio/embeds
 *      sidebar-link-analytics              → /studio/analytics
 *
 *  Mobile sheet top-level links (always visible in drawer):
 *    mobile-link-watch     → /feed
 *    mobile-link-live      → /live
 *    mobile-link-studio    → /studio/portfolio  (signed-in only)
 *    mobile-link-community → /community
 *    mobile-link-pricing   → /pricing
 *
 *  Mobile sheet sub-items (only visible when already in that section):
 *    Live section:
 *      mobile-link-streaming          → /live
 *      mobile-link-cinema-events      → /cinema
 *      mobile-link-replays            → /live/replays
 *    Studio section (signed-in):
 *      mobile-link-portfolio-collections → /studio/portfolio
 *      mobile-link-media-library         → /studio/storage
 *      mobile-link-client-delivery       → /studio/delivery
 *      mobile-link-website-embedding     → /studio/embeds
 *      mobile-link-analytics             → /studio/analytics
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page) {
  await page.goto("/api/dev/login");
  await page.waitForURL(/\//);
}

async function signOut(page: Page) {
  await page.goto("/api/dev/logout");
  await page.waitForURL(/\//);
}

/** Click a top-nav flat link. */
async function clickTopNav(page: Page, testid: string) {
  await page.click(`[data-testid="${testid}"]`);
}

/** Open mobile sheet and click an item. */
async function clickMobileSheetItem(page: Page, itemTestId: string) {
  await page.getByTestId("btn-mobile-menu").click();
  const link = page.getByTestId(itemTestId);
  await link.waitFor({ state: "visible" });
  await link.click();
}

// ---------------------------------------------------------------------------
// Signed-out: top-nav flat links (desktop)
// ---------------------------------------------------------------------------

test.describe("signed-out / top-nav flat links (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
    await page.goto("/");
  });

  test("Watch link → /feed", async ({ page }) => {
    await clickTopNav(page, "link-watch");
    await expect(page).toHaveURL(/\/feed/);
  });

  test("Live link → /live", async ({ page }) => {
    await clickTopNav(page, "link-live");
    await expect(page).toHaveURL(/\/live($|[^/])/);
  });

  test("Community link → /community", async ({ page }) => {
    await clickTopNav(page, "link-community");
    await expect(page).toHaveURL(/\/community/);
  });

  test("Pricing link → /pricing", async ({ page }) => {
    await clickTopNav(page, "link-pricing");
    await expect(page).toHaveURL(/\/pricing/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: top-nav flat links (desktop)
// ---------------------------------------------------------------------------

test.describe("signed-in / top-nav flat links (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("Watch link → /feed", async ({ page }) => {
    await clickTopNav(page, "link-watch");
    await expect(page).toHaveURL(/\/feed/);
  });

  test("Studio link → /studio/portfolio", async ({ page }) => {
    await clickTopNav(page, "link-studio");
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });
});

// ---------------------------------------------------------------------------
// Signed-out: contextual sidebar (desktop)
// Navigate to a section first so its sidebar appears, then click sub-items.
// ---------------------------------------------------------------------------

test.describe("signed-out / contextual sidebar (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
  });

  test("Watch sidebar: /feed via sidebar-link-feed", async ({ page }) => {
    await page.goto("/feed");
    await page.getByTestId("sidebar-link-feed").click();
    await expect(page).toHaveURL(/\/feed/);
  });

  test("Watch sidebar: genre link → /explore?genre=Documentary", async ({ page }) => {
    await page.goto("/feed");
    await page.getByTestId("sidebar-link-genre-documentary").click();
    await expect(page).toHaveURL(/\/explore/);
  });

  test("Live sidebar: /cinema via sidebar-link-cinema-events", async ({ page }) => {
    await page.goto("/live");
    await page.getByTestId("sidebar-link-cinema-events").click();
    await expect(page).toHaveURL(/\/cinema/);
  });

  test("Live sidebar: /live/replays via sidebar-link-replays", async ({ page }) => {
    await page.goto("/live");
    await page.getByTestId("sidebar-link-replays").click();
    await expect(page).toHaveURL(/\/live\/replays/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: contextual sidebar — Studio section (desktop)
// ---------------------------------------------------------------------------

test.describe("signed-in / Studio sidebar (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/studio/portfolio");
  });

  test("sidebar renders on /studio/* route", async ({ page }) => {
    await expect(page.getByTestId("sidebar-link-portfolio-collections")).toBeVisible();
  });

  test("/studio/portfolio via sidebar-link-portfolio-collections", async ({ page }) => {
    await page.getByTestId("sidebar-link-portfolio-collections").click();
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });

  test("/studio/storage via sidebar-link-media-library", async ({ page }) => {
    await page.getByTestId("sidebar-link-media-library").click();
    await expect(page).toHaveURL(/\/studio\/storage/);
  });

  test("/studio/delivery via sidebar-link-client-delivery", async ({ page }) => {
    await page.getByTestId("sidebar-link-client-delivery").click();
    await expect(page).toHaveURL(/\/studio\/delivery/);
  });

  test("/studio/embeds via sidebar-link-website-embedding", async ({ page }) => {
    await page.getByTestId("sidebar-link-website-embedding").click();
    await expect(page).toHaveURL(/\/studio\/embeds/);
  });

  test("/studio/analytics via sidebar-link-analytics", async ({ page }) => {
    await page.getByTestId("sidebar-link-analytics").click();
    await expect(page).toHaveURL(/\/studio\/analytics/);
  });
});

// ---------------------------------------------------------------------------
// Signed-out: mobile Sheet — top-level links
// ---------------------------------------------------------------------------

test.describe("signed-out / mobile Sheet top-level links", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
    await page.goto("/");
  });

  test("mobile Watch → /feed", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-watch");
    await expect(page).toHaveURL(/\/feed/);
  });

  test("mobile Live → /live", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-live");
    await expect(page).toHaveURL(/\/live($|[^/])/);
  });

  test("mobile Community → /community", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-community");
    await expect(page).toHaveURL(/\/community/);
  });

  test("mobile Pricing → /pricing", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-pricing");
    await expect(page).toHaveURL(/\/pricing/);
  });
});

// ---------------------------------------------------------------------------
// Signed-out: mobile Sheet — Live sub-items
// Navigate to /live first so the Live section's sub-items appear in the drawer.
// ---------------------------------------------------------------------------

test.describe("signed-out / mobile Sheet Live sub-items", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
    await page.goto("/live");
  });

  test("mobile Cinema Events → /cinema", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-cinema-events");
    await expect(page).toHaveURL(/\/cinema/);
  });

  test("mobile Replays → /live/replays", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-replays");
    await expect(page).toHaveURL(/\/live\/replays/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: mobile Sheet — top-level links
// ---------------------------------------------------------------------------

test.describe("signed-in / mobile Sheet top-level links", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("mobile Watch → /feed", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-watch");
    await expect(page).toHaveURL(/\/feed/);
  });

  test("mobile Studio → /studio/portfolio", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-studio");
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: mobile Sheet — Studio sub-items
// Navigate to a /studio/* page first so Studio sub-items appear in the drawer.
// ---------------------------------------------------------------------------

test.describe("signed-in / mobile Sheet Studio sub-items", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/studio/portfolio");
  });

  test("mobile Portfolio Collections → /studio/portfolio", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-portfolio-collections");
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });

  test("mobile Media Library → /studio/storage", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-media-library");
    await expect(page).toHaveURL(/\/studio\/storage/);
  });

  test("mobile Client Delivery → /studio/delivery", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-client-delivery");
    await expect(page).toHaveURL(/\/studio\/delivery/);
  });

  test("mobile Website Embedding → /studio/embeds", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-website-embedding");
    await expect(page).toHaveURL(/\/studio\/embeds/);
  });

  test("mobile Analytics → /studio/analytics", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-analytics");
    await expect(page).toHaveURL(/\/studio\/analytics/);
  });
});
