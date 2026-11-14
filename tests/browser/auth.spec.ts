import { test, expect } from "@playwright/test";

test("login validates, submits, reports errors and signs out", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill("sam@example.com");
  await page.getByLabel("Password", { exact: true }).fill("existing-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.route("**/api/auth/login", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "sam@example.com", password: "existing-password" });
    await route.fulfill({ status: 400, json: { message: "Check your details and confirm your email." } });
  });
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".form-error")).toHaveText("Check your details and confirm your email.");
  await page.unroute("**/api/auth/login");
  await page.route("**/api/auth/login", route => route.fulfill({ json: { message: "Signed in." } }));
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Dorytos." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});

test("signup validates matching passwords and shows confirmation", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Sam Shopper");
  await page.getByLabel("Email address", { exact: true }).fill("sam@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strong123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Different123!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await page.getByLabel("Confirm password", { exact: true }).fill("Strong123!");
  await page.route("**/api/auth/signup", route => route.fulfill({ status: 201, json: { message: "Account created." } }));
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to login" })).toHaveAttribute("href", "/login");
});

test("desktop and mobile layouts fit and logo loads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/login");
  await expect(page.getByAltText("Dorytos — blue fish logo")).toBeVisible();
  await page.getByRole("button", { name: "Show password", exact: true }).click(); await page.getByRole("button", { name: "Hide password", exact: true }).click(); await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true });
  await page.goto("/signup");
  await page.getByRole("button", { name: "Show password", exact: true }).click(); await page.getByRole("button", { name: "Hide password", exact: true }).click(); await page.screenshot({ path: "test-results/signup-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Show password", exact: true }).click(); await page.getByRole("button", { name: "Hide password", exact: true }).click(); await page.screenshot({ path: "test-results/signup-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByAltText("Dorytos home")).toBeVisible();
});

test("signup rejects international phone example and accepts 11 local digits", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Sam Shopper");
  await page.getByLabel("Email address", { exact: true }).fill("sam@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strong123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Strong123!");
  const phone = page.getByLabel("Phone number", { exact: false });
  await phone.fill("+20 100 123 4567");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Enter an 11-digit phone number, e.g. 01001234567 (no country code or spaces).", { exact: true })).toBeVisible();
  await phone.fill("01001234567");
  await page.route("**/api/auth/signup", async route => {
    expect(route.request().postDataJSON().phone).toBe("01001234567");
    await route.fulfill({ status: 201, json: { message: "Account created." } });
  });
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
});
