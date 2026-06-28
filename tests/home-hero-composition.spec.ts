import { expect, test, type Page } from "playwright/test";

// The active home composition is the Season 3 "Human Credits" hero. The retained
// legacy split composition is covered by the Node contract verifier
// (scripts/verify_home_hero_contract.mjs), which renders it for rollback safety.

const FEED_GLOB = "**/profiles/public*";
const SUBMISSIONS_GLOB = "**/me/submissions*";
const PROFILE_GLOB = "**/me/profile*";

function sampleProfiles(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    handle: `member${index}`,
    display_name: `Member ${index}`,
    picture: "",
    role: "Performer",
    instrument: "Cello",
    dex_id: `DEX-${index}`,
    profile_url: `/u/member${index}/`,
  }));
}

async function stubAuthenticated(page: Page, submissionThreads: unknown[]) {
  await page.route(SUBMISSIONS_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ threads: submissionThreads }) }),
  );
  await page.route(PROFILE_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ public_profile: { handle: "member0", dex_id: "DEX-0" } }) }),
  );
  await page.evaluate(() => {
    (window as unknown as { DEX_AUTH: unknown }).DEX_AUTH = {
      ready: Promise.resolve({ isAuthenticated: true }),
      getAccessToken: async () => "test-token",
      signUp: () => {},
    };
    window.dispatchEvent(new CustomEvent("dex-auth:state", { detail: { isAuthenticated: true } }));
  });
}

test.describe("season 3 human credits hero", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("renders the accessible Season 3 stage with seed fallback when the feed fails", async ({ page }) => {
    // Feed unavailable: the experience must keep its seed credits + openings.
    await page.route(FEED_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/");
    const module = page.locator('[data-module-type="season3-human-credits"]');
    await expect(module).toHaveCount(1);
    await expect(module.locator(".dx-s3__headline")).toHaveText("SEASON 3 IS YOU.");
    await expect(module.locator(".dx-s3-pipeline__step")).toHaveCount(5);
    // Seed releases survive a failed feed; no error surface replaces the field.
    await expect(module.locator(".dx-s3-card--release")).toHaveCount(4);
    await expect(module.locator(".dx-s3-card--opening").first()).toBeVisible();
  });

  test("guest CTA invites signup, member-without-submission flips to submit", async ({ page }) => {
    await page.route(FEED_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/");
    const cta = page.locator("[data-dx-s3-cta]");
    await expect(cta).toHaveText("JOIN SEASON 3");
    await expect(cta).toHaveAttribute("data-mode", "guest");

    await stubAuthenticated(page, []);
    await expect(cta).toHaveText("SUBMIT TO SEASON 3");
    await expect(cta).toHaveAttribute("data-mode", "submit");
  });

  test("active submission opens the private pipeline; published views the release", async ({ page }) => {
    await page.route(FEED_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/");
    const cta = page.locator("[data-dx-s3-cta]");

    // Active work takes precedence and surfaces the private-stage note.
    await stubAuthenticated(page, [
      { currentStage: "reviewing" },
      { currentStage: "in_library", libraryHref: "/entry/my-release/" },
    ]);
    await expect(cta).toHaveText("OPEN MY PIPELINE");
    await expect(cta).toHaveAttribute("data-mode", "active");
    await expect(page.locator("[data-dx-s3-cta-state]")).toBeVisible();

    // Published-only: deep link to the release.
    await page.unroute(SUBMISSIONS_GLOB);
    await page.route(SUBMISSIONS_GLOB, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ threads: [{ currentStage: "in_library", libraryHref: "/entry/my-release/" }] }) }),
    );
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dex-auth:state", { detail: { isAuthenticated: true } })));
    await expect(cta).toHaveText("VIEW MY RELEASE");
    await expect(cta).toHaveAttribute("href", "/entry/my-release/");
  });

  test("public profiles replace openings first and link to the profile", async ({ page }) => {
    await page.route(FEED_GLOB, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profiles: sampleProfiles(3) }) }),
    );
    await page.goto("/");
    const module = page.locator('[data-module-type="season3-human-credits"]');
    await expect(module.locator(".dx-s3-card--profile")).toHaveCount(3);
    // Openings fill before seed releases are touched.
    await expect(module.locator(".dx-s3-card--release")).toHaveCount(4);
    const tile = module.locator(".dx-s3-card--profile").first();
    await expect(tile).toHaveAttribute("href", /^\/u\/member\d+\/$/);
  });

  test("reduced motion yields a static composition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route(FEED_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/");
    const module = page.locator('[data-module-type="season3-human-credits"]');
    await expect(module).toHaveClass(/is-static/);
    await expect(module).not.toHaveClass(/is-playing/);
  });
});

test("season 3 hero stacks its field on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await page.route(FEED_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/");
  const cards = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>(".dx-s3__field .dx-s3-card"));
    return { count: all.length, columns: getComputedStyle(document.querySelector<HTMLElement>(".dx-s3__field")!).gridTemplateColumns.split(" ").length };
  });
  expect(cards.count).toBeGreaterThan(0);
  // Mobile uses a narrower minimum so the field still forms a multi-column grid.
  expect(cards.columns).toBeGreaterThanOrEqual(2);
});
