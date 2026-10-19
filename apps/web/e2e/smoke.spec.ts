import { expect, test, type Page } from "@playwright/test";

// A 1x1 JPEG.
const JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8Az6KKK/lc/tg//9k=";

const run = Date.now();
const uidA = `a${run}`;
const uidB = `b${run}`;

async function signIn(page: Page, uid: string, next: string) {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("User id").fill(uid);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

test("public place page", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator('a[href^="/places/"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(1);
  await cards.first().click();
  await page.waitForURL(/\/places\/[^/?]+$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent())?.trim();
  expect(title).toBeTruthy();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    title!,
  );
});

test("map shows place markers", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".memopin-marker").first()).toBeVisible();
  expect(await page.locator(".memopin-marker").count()).toBeGreaterThanOrEqual(1);
});

test.describe.serial("accounts", () => {
  test("sign in and rename", async ({ page }) => {
    await signIn(page, uidA, "/me");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("user");
    await page.getByRole("button", { name: "Edit name" }).click();
    await page.getByLabel("Display name").fill("E2E A");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E A");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E A");
  });

  test("follow gate", async ({ page }) => {
    await signIn(page, uidB, "/me");
    await page.goto(`/u/${uidA}`);
    await expect(
      page.getByText("Follow E2E A to see their stories."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      page.getByText("Follow E2E A to see their stories."),
    ).toHaveCount(0);
    await expect(page.getByText("1 follower")).toBeVisible();
  });

  test("post story", async ({ page }) => {
    await signIn(page, uidA, "/post");
    await page.getByLabel("Photo").setInputFiles({
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(JPEG_BASE64, "base64"),
    });
    await page.getByLabel("Title").fill("E2E story");
    await page.getByRole("button", { name: "Post story" }).click();
    await page.waitForURL(/\/places\/[^/?]+\?posted=1$/);
    await expect(
      page.getByRole("button", { name: /E2E story/ }),
    ).toBeVisible();
  });
});
