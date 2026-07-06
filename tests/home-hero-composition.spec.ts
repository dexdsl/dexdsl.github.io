import { expect, test, type Page, type Locator } from "playwright/test";
import fs from "node:fs";
import path from "node:path";
import { renderHomeHero } from "../scripts/lib/home-hero-render.mjs";

// Exercise the stored Season 3 composition independently of whichever composition
// is currently published at "/". The production runtime is already loaded by the
// homepage; the helper below swaps only the hero mount and re-runs its public boot
// event, so the tests cover the same hydration code without changing live content.

const ROOT = process.cwd();
const library = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "home.hero-library.json"), "utf8"));
const catalogData = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.entries.json"), "utf8"));
const season3Composition = library.compositions.find((row: { id?: string }) => row.id === "season3-human-credits");
const season3ModuleConfig = library.modules.find((row: { id?: string }) => row.id === "season3-human-credits");
if (!season3Composition || !season3ModuleConfig) throw new Error("Season 3 hero fixture is missing");
const season3Markup = renderHomeHero({
  activeCompositionId: season3Composition.id,
  composition: season3Composition,
  modules: [season3ModuleConfig],
}, { catalogData });

const FACES_GLOB = "**/profiles/public*";
const WORKS_GLOB = "**/catalog.entries.json*";
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

function sampleWorks(count: number) {
  return {
    entries: Array.from({ length: count }, (_unused, index) => ({
      id: `work-${index}`,
      performer_raw: `Worker ${index}`,
      title_raw: `WORK ${index}`,
      instrument_labels: ["Modular Synth"],
      lookup_raw: `W.W. W${index} AV2024 S2`,
      season: "S2",
      entry_href: `/entry/work-${index}/`,
      image_src: `/assets/catalog/work-${index}.webp`,
      status: "active",
    })),
  };
}

async function stubFeeds(page: Page, profiles: unknown[], works: unknown) {
  await page.route(FACES_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profiles }) }),
  );
  await page.route(WORKS_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(works) }),
  );
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

async function mountSeason3(page: Page) {
  await page.goto("/");
  await page.evaluate((markup) => {
    const mount = document.querySelector<HTMLElement>("[data-dx-home-hero-root]");
    if (!mount) throw new Error("Homepage hero mount is missing");
    mount.innerHTML = markup;
    mount.dataset.dxHomeHeroSsr = "true";
    mount.dataset.compositionId = "season3-human-credits";
    delete mount.dataset.ready;
    document.dispatchEvent(new CustomEvent("dex:page-ready"));
  }, season3Markup);
}

async function season3Module(page: Page): Promise<Locator | null> {
  const module = page.locator('[data-module-type="season3-human-credits"]');
  if ((await module.count()) === 0) return null;
  return module;
}

test.describe("season 3 credits wall hero", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("renders the wall from member faces + their work", async ({ page }) => {
    await stubFeeds(page, sampleProfiles(3), sampleWorks(8));
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    await expect(module!.locator(".dx-s3__headline")).toHaveText("SEASON 3 IS YOU.");
    await expect(module!.locator("[data-dx-s3-wall]")).toHaveAttribute("data-wall-loaded", "true");
    // Every member survives the cap; the open slot is always present.
    await expect(module!.locator(".dx-s3-tile--face")).toHaveCount(3);
    await expect(module!.locator(".dx-s3-tile--open")).toHaveCount(1);
    await expect(module!.locator(".dx-s3-tile--work").first()).toBeVisible();
    await expect(module!.locator(".dx-s3-tile--face").first()).toHaveAttribute("href", /^\/u\/member\d+\/$/);
  });

  test("keeps a populated wall when the faces feed fails", async ({ page }) => {
    await page.route(FACES_GLOB, (route) => route.fulfill({ status: 503, body: "" }));
    await page.route(WORKS_GLOB, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sampleWorks(10)) }),
    );
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    await expect(module!.locator(".dx-s3-tile--work").first()).toBeVisible();
    await expect(module!.locator(".dx-s3-tile--open")).toHaveCount(1);
  });

  test("guest CTA invites signup, member-without-submission flips to submit", async ({ page }) => {
    await stubFeeds(page, sampleProfiles(2), sampleWorks(4));
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    const cta = module!.locator("[data-dx-s3-cta]");
    await expect(cta).toHaveText("JOIN SEASON 3");
    await expect(cta).toHaveAttribute("data-mode", "guest");

    await stubAuthenticated(page, []);
    await expect(cta).toHaveText("SUBMIT TO SEASON 3");
    await expect(cta).toHaveAttribute("data-mode", "submit");
  });

  test("an existing submission flips the CTA to submit-more, with no pipeline note", async ({ page }) => {
    await stubFeeds(page, sampleProfiles(2), sampleWorks(4));
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    const cta = module!.locator("[data-dx-s3-cta]");

    // Any existing submission (in-progress or published) → the same invite to add more.
    await stubAuthenticated(page, [
      { currentStage: "reviewing" },
      { currentStage: "in_library", libraryHref: "/entry/my-release/" },
    ]);
    await expect(cta).toHaveText("SUBMIT MORE");
    await expect(cta).toHaveAttribute("data-mode", "submitted");
    await expect(cta).toHaveAttribute("href", "/entry/submit/?flow=sample");
    // No pipeline / private-stage text in the signed-out-looking hero.
    await expect(module!.locator("[data-dx-s3-cta-state]")).toBeHidden();
  });

  test("the wall renders identically signed in — no own-tile highlight", async ({ page }) => {
    await stubFeeds(page, sampleProfiles(3), sampleWorks(6));
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    await stubAuthenticated(page, []);
    // The @you open slot stays; no member (incl. the viewer) is ringed.
    await expect(module!.locator(".dx-s3-tile.is-own")).toHaveCount(0);
    await expect(module!.locator(".dx-s3-tile--open")).toHaveCount(1);
  });

  test("reduced motion yields a static composition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubFeeds(page, sampleProfiles(2), sampleWorks(4));
    await mountSeason3(page);
    const module = await season3Module(page);
    expect(module).not.toBeNull();
    await expect(module!).toHaveClass(/is-static/);
    await expect(module!).not.toHaveClass(/is-playing/);
  });
});

test("season 3 hero stacks its wall on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await stubFeeds(page, sampleProfiles(2), sampleWorks(8));
  await mountSeason3(page);
  const wall = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".dx-s3__wall");
    if (!el) return { present: false, columns: 0 };
    return { present: true, columns: getComputedStyle(el).gridTemplateColumns.split(" ").length };
  });
  expect(wall.present).toBe(true);
  // The wall still forms a multi-column grid on a narrow viewport.
  expect(wall.columns).toBeGreaterThanOrEqual(2);
});
