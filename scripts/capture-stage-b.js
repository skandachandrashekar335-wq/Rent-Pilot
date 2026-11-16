const task = await taskSpace("stage-b-verification");
const page = task.page("p1");

const screenshotsDir = "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots";

// 1. Login Desktop
console.log("Navigating to Login (Desktop)...");
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});
await page.goto("http://localhost:3008/login");
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-b-login-desktop.png` });
console.log("Captured stage-b-login-desktop.png");

// 2. Login Mobile (390x844 iPhone)
console.log("Navigating to Login (Mobile)...");
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${screenshotsDir}/stage-b-login-mobile.png` });
console.log("Captured stage-b-login-mobile.png");

// Reset to Desktop
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});

// 3. Owner Guard (Unauthenticated redirect/prompt)
console.log("Navigating to /dashboard/owner (Owner Guard)...");
await page.goto("http://localhost:3008/dashboard/owner");
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-b-owner-guard.png` });
console.log("Captured stage-b-owner-guard.png");

// 4. Tenant Guard (Unauthenticated redirect/prompt)
console.log("Navigating to /portal (Tenant Guard)...");
await page.goto("http://localhost:3008/portal");
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-b-tenant-guard.png` });
console.log("Captured stage-b-tenant-guard.png");

// 5. Tenant Invitation Review Page
console.log("Navigating to /invite/test-token...");
await page.goto("http://localhost:3008/invite/sample-test-invitation-token-12345");
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-b-invite-review.png` });
console.log("Captured stage-b-invite-review.png");

await task.finish({ keep: false });
console.log("All visual verifications captured successfully!");
