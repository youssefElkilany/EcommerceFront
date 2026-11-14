import { test, expect } from "@playwright/test";

test("password recovery validates, resends, handles wrong codes and resets", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  let sends = 0;
  await page.route("**/api/auth/passcode", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "sam@example.com" });
    sends++;
    await route.fulfill({ json: { message: "done" } });
  });
  await page.getByLabel("Email address").fill("SAM@example.com");
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page.getByRole("heading", { name: "Set a new password." })).toBeVisible();
  await page.getByRole("button", { name: "Resend code" }).click();
  await expect(page.getByRole("status")).toContainText("A new code has been sent");
  expect(sends).toBe(2);
  await page.getByLabel("Reset code").fill("123");
  await page.getByLabel("New password", { exact: true }).fill("Strong123!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Other123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Enter the 4-digit code from your email.")).toBeVisible();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await page.getByLabel("Reset code").fill("0123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Strong123!");
  await page.route("**/api/auth/resetcode", route => route.fulfill({ status: 400, json: { message: "That code is incorrect. Try again or request a new code." } }));
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator(".form-error")).toContainText("That code is incorrect");
  await page.unroute("**/api/auth/resetcode");
  await page.route("**/api/auth/resetcode", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "sam@example.com", otp: "0123", password: "Strong123!", cPassword: "Strong123!" });
    await route.fulfill({ json: { message: "done" } });
  });
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();
  await page.getByRole("link", { name: "Back to login" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("recovery preserves email on failure and supports changing email on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/forgot-password");
  await page.route("**/api/auth/passcode", route => route.fulfill({ status: 503, json: { message: "Email service unavailable. Try again." } }));
  await page.getByLabel("Email address").fill("sam@example.com");
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page.locator(".form-error")).toContainText("Email service unavailable");
  await expect(page.getByLabel("Email address")).toHaveValue("sam@example.com");
  await page.unroute("**/api/auth/passcode");
  await page.route("**/api/auth/passcode", route => route.fulfill({ json: { message: "done" } }));
  await page.getByRole("button", { name: "Send reset code" }).click();
  await page.getByRole("button", { name: "Show new password", exact: true }).click();
  await page.getByRole("button", { name: "Hide new password", exact: true }).click();
  await page.screenshot({ path: "test-results/reset-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("sam@example.com");
});
