const task = await taskSpace("stage-c-verification");
const page = task.page("p1");

const screenshotsDir = "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots";

// 1. Owner Properties Dashboard (Desktop)
console.log("Navigating to /dashboard/owner/properties...");
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});
await page.goto("http://localhost:3008/dashboard/owner/properties");
await page.waitForTimeout(600);

// If guard appears, click Demo Owner Mode
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Demo Mode"));
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-c-properties-desktop.png` });
console.log("Captured stage-c-properties-desktop.png");

// 2. Owner Properties Dashboard (Mobile 390x844)
console.log("Switching to Mobile (390x844)...");
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${screenshotsDir}/stage-c-properties-mobile.png` });
console.log("Captured stage-c-properties-mobile.png");

// Reset to Desktop
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});
await page.waitForTimeout(500);

// 3. Open "Add Property" Dialog
console.log("Opening Add Property Dialog...");
const clickedAdd = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Add Property"));
  if (btn) {
    btn.click();
    return true;
  }
  return false;
});
if (clickedAdd) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${screenshotsDir}/stage-c-add-property-dialog.png` });
  console.log("Captured stage-c-add-property-dialog.png");
}

// 4. Tenant Profile Page (Desktop)
console.log("Navigating to /portal/profile...");
await page.goto("http://localhost:3008/portal/profile");
await page.waitForTimeout(600);

// If guard appears, click Demo Tenant Mode
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Demo Mode"));
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotsDir}/stage-c-tenant-profile-desktop.png` });
console.log("Captured stage-c-tenant-profile-desktop.png");

// 5. Tenant Profile Page (Mobile)
console.log("Capturing Mobile Tenant Profile...");
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${screenshotsDir}/stage-c-tenant-profile-mobile.png` });
console.log("Captured stage-c-tenant-profile-mobile.png");

await task.finish({ keep: [] });
console.log("All Stage C visual captures completed successfully!");
