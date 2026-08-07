/**
 * Nav smoke tests — Task #18
 *
 * Verifies that every previously-linked route is still reachable from at least
 * one nav surface after the sidebar deduplication.
 *
 * Routes under test:
 *   /explore, /feed, /live, /cinema, /live/replays,
 *   /studio/portfolio, /studio/storage, /studio/delivery,
 *   /studio/embeds, /studio/analytics, /store, /pricing
 *
 * Nav surfaces covered:
 *   • Top-nav direct links & group dropdowns (desktop ≥768 px)
 *   • Mobile Sheet (viewport 390 px wide)
 *   • Studio sidebar (visible on /studio/* for signed-in users)
 *
 * Auth setup (dev environment only):
 *   • Signed-in:  GET /api/dev/login  — sets demo user session
 *   • Signed-out: GET /api/dev/logout — clears session
 *
 * data-testid map (from artifacts/chroma/src/components/layout.tsx):
 *
 *   Top-nav triggers
 *     link-view              → /explore
 *     link-feed              → /feed          (signed-in)
 *     nav-group-live         → Live dropdown
 *     nav-group-studio       → Studio dropdown (signed-in)
 *     nav-group-shop         → Shop dropdown
 *     link-pricing           → /pricing
 *
 *   Top-nav dropdown items
 *     nav-link-streaming           → /live
 *     nav-link-cinema-events       → /cinema
 *     nav-link-replays             → /live/replays
 *     nav-link-portfolio-collections → /studio/portfolio
 *     nav-link-media-library       → /studio/storage
 *     nav-link-client-delivery     → /studio/delivery
 *     nav-link-website-embedding   → /studio/embeds
 *     nav-link-analytics           → /studio/analytics
 *     nav-link-download-shop       → /store
 *
 *   Mobile Sheet links
 *     mobile-link-watch              → /explore
 *     mobile-link-feed               → /feed           (signed-in)
 *     mobile-link-streaming          → /live
 *     mobile-link-cinema-events      → /cinema
 *     mobile-link-replays            → /live/replays
 *     mobile-link-portfolio-collections → /studio/portfolio (signed-in)
 *     mobile-link-media-library      → /studio/storage  (signed-in)
 *     mobile-link-client-delivery    → /studio/delivery (signed-in)
 *     mobile-link-website-embedding  → /studio/embeds   (signed-in)
 *     mobile-link-analytics          → /studio/analytics(signed-in)
 *     mobile-link-download-shop      → /store
 *     mobile-link-pricing            → /pricing
 *
 *   Studio sidebar (on /studio/* signed-in, lg screen)
 *     sidebar-link-portfolio-collections → /studio/portfolio
 *     sidebar-link-media-library         → /studio/storage
 *     sidebar-link-client-delivery       → /studio/delivery
 *     sidebar-link-website-embedding     → /studio/embeds
 *     sidebar-link-analytics             → /studio/analytics
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page) {
  await page.goto("/api/dev/login");
  // Dev toggle redirects to /
  await page.waitForURL(/\//);
}

async function signOut(page: Page) {
  await page.goto("/api/dev/logout");
  await page.waitForURL(/\//);
}

/** Open a top-nav dropdown and click the item with the given testid. */
async function clickDropdownItem(
  page: Page,
  groupTestId: string,
  itemTestId: string,
) {
  await page.click(`[data-testid="${groupTestId}"]`);
  await page.waitForSelector(`[data-testid="${itemTestId}"]`, { state: "visible" });
  await page.click(`[data-testid="${itemTestId}"]`);
}

/** Open the mobile sheet (hamburger) and click the item with the given testid. */
async function clickMobileSheetItem(page: Page, itemTestId: string) {
  const trigger = page.getByTestId("btn-mobile-menu");
  await trigger.click();
  const link = page.getByTestId(itemTestId);
  await link.waitFor({ state: "visible" });
  await link.click();
}

// ---------------------------------------------------------------------------
// Signed-out: top-nav (desktop)
// ---------------------------------------------------------------------------

test.describe("signed-out / top-nav (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
    await page.goto("/");
  });

  test("/explore reachable via Watch link", async ({ page }) => {
    await page.click('[data-testid="link-view"]');
    await expect(page).toHaveURL(/\/explore/);
  });

  test("/live reachable via Live › Streaming", async ({ page }) => {
    await clickDropdownItem(page, "nav-group-live", "nav-link-streaming");
    await expect(page).toHaveURL(/\/live($|[^/])/);
  });

  test("/cinema reachable via Live › Cinema Events", async ({ page }) => {
    await clickDropdownItem(page, "nav-group-live", "nav-link-cinema-events");
    await expect(page).toHaveURL(/\/cinema/);
  });

  test("/live/replays reachable via Live › Replays", async ({ page }) => {
    await clickDropdownItem(page, "nav-group-live", "nav-link-replays");
    await expect(page).toHaveURL(/\/live\/replays/);
  });

  test("/store reachable via Shop › Download Shop", async ({ page }) => {
    await clickDropdownItem(page, "nav-group-shop", "nav-link-download-shop");
    await expect(page).toHaveURL(/\/store/);
  });

  test("/pricing reachable via Pricing link", async ({ page }) => {
    await page.click('[data-testid="link-pricing"]');
    await expect(page).toHaveURL(/\/pricing/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: top-nav (desktop)
// ---------------------------------------------------------------------------

test.describe("signed-in / top-nav (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("/feed reachable via Feed link", async ({ page }) => {
    await page.click('[data-testid="link-feed"]');
    await expect(page).toHaveURL(/\/feed/);
  });

  test("/studio/portfolio reachable via Studio › Portfolio Collections", async ({
    page,
  }) => {
    await clickDropdownItem(
      page,
      "nav-group-studio",
      "nav-link-portfolio-collections",
    );
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });

  test("/studio/storage reachable via Studio › Media Library", async ({
    page,
  }) => {
    await clickDropdownItem(
      page,
      "nav-group-studio",
      "nav-link-media-library",
    );
    await expect(page).toHaveURL(/\/studio\/storage/);
  });

  test("/studio/delivery reachable via Studio › Client Delivery", async ({
    page,
  }) => {
    await clickDropdownItem(
      page,
      "nav-group-studio",
      "nav-link-client-delivery",
    );
    await expect(page).toHaveURL(/\/studio\/delivery/);
  });

  test("/studio/embeds reachable via Studio › Website Embedding", async ({
    page,
  }) => {
    await clickDropdownItem(
      page,
      "nav-group-studio",
      "nav-link-website-embedding",
    );
    await expect(page).toHaveURL(/\/studio\/embeds/);
  });

  test("/studio/analytics reachable via Studio › Analytics", async ({
    page,
  }) => {
    await clickDropdownItem(
      page,
      "nav-group-studio",
      "nav-link-analytics",
    );
    await expect(page).toHaveURL(/\/studio\/analytics/);
  });
});

// ---------------------------------------------------------------------------
// Signed-out: mobile Sheet
// ---------------------------------------------------------------------------

test.describe("signed-out / mobile Sheet", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signOut(page);
    await page.goto("/");
  });

  test("/explore reachable via mobile Watch", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-watch");
    await expect(page).toHaveURL(/\/explore/);
  });

  test("/live reachable via mobile Streaming", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-streaming");
    await expect(page).toHaveURL(/\/live($|[^/])/);
  });

  test("/cinema reachable via mobile Cinema Events", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-cinema-events");
    await expect(page).toHaveURL(/\/cinema/);
  });

  test("/live/replays reachable via mobile Replays", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-replays");
    await expect(page).toHaveURL(/\/live\/replays/);
  });

  test("/store reachable via mobile Download Shop", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-download-shop");
    await expect(page).toHaveURL(/\/store/);
  });

  test("/pricing reachable via mobile Pricing", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-pricing");
    await expect(page).toHaveURL(/\/pricing/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: mobile Sheet
// ---------------------------------------------------------------------------

test.describe("signed-in / mobile Sheet", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("/feed reachable via mobile Feed", async ({ page }) => {
    await clickMobileSheetItem(page, "mobile-link-feed");
    await expect(page).toHaveURL(/\/feed/);
  });

  test("/studio/portfolio reachable via mobile Portfolio Collections", async ({
    page,
  }) => {
    await clickMobileSheetItem(page, "mobile-link-portfolio-collections");
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });

  test("/studio/storage reachable via mobile Media Library", async ({
    page,
  }) => {
    await clickMobileSheetItem(page, "mobile-link-media-library");
    await expect(page).toHaveURL(/\/studio\/storage/);
  });

  test("/studio/delivery reachable via mobile Client Delivery", async ({
    page,
  }) => {
    await clickMobileSheetItem(page, "mobile-link-client-delivery");
    await expect(page).toHaveURL(/\/studio\/delivery/);
  });

  test("/studio/embeds reachable via mobile Website Embedding", async ({
    page,
  }) => {
    await clickMobileSheetItem(page, "mobile-link-website-embedding");
    await expect(page).toHaveURL(/\/studio\/embeds/);
  });

  test("/studio/analytics reachable via mobile Analytics", async ({
    page,
  }) => {
    await clickMobileSheetItem(page, "mobile-link-analytics");
    await expect(page).toHaveURL(/\/studio\/analytics/);
  });
});

// ---------------------------------------------------------------------------
// Signed-in: Studio sidebar (desktop lg, on a /studio/* route)
// ---------------------------------------------------------------------------

test.describe("signed-in / Studio sidebar", () => {
  // Sidebar only appears at lg breakpoint (≥1024 px)
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    // Start on any studio page so the sidebar renders
    await page.goto("/studio/portfolio");
  });

  test("sidebar renders on /studio/* route", async ({ page }) => {
    await expect(
      page.getByTestId("sidebar-link-portfolio-collections"),
    ).toBeVisible();
  });

  test("/studio/portfolio reachable via sidebar", async ({ page }) => {
    await page.getByTestId("sidebar-link-portfolio-collections").click();
    await expect(page).toHaveURL(/\/studio\/portfolio/);
  });

  test("/studio/storage reachable via sidebar", async ({ page }) => {
    await page.getByTestId("sidebar-link-media-library").click();
    await expect(page).toHaveURL(/\/studio\/storage/);
  });

  test("/studio/delivery reachable via sidebar", async ({ page }) => {
    await page.getByTestId("sidebar-link-client-delivery").click();
    await expect(page).toHaveURL(/\/studio\/delivery/);
  });

  test("/studio/embeds reachable via sidebar", async ({ page }) => {
    await page.getByTestId("sidebar-link-website-embedding").click();
    await expect(page).toHaveURL(/\/studio\/embeds/);
  });

  test("/studio/analytics reachable via sidebar", async ({ page }) => {
    await page.getByTestId("sidebar-link-analytics").click();
    await expect(page).toHaveURL(/\/studio\/analytics/);
  });
});
