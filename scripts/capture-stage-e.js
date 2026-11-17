async function main() {
  const task = await taskSpace("stage-e-capture");
  const page = task.page("p1");

  console.log("Capturing Stage E views...");

  // 1. Owner Maintenance Hub (Desktop)
  await page.goto("http://localhost:3008/dashboard/owner/maintenance", { waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-e-owner-maintenance-desktop.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner/maintenance (Desktop)");

  // 2. Owner Maintenance Hub (Mobile 390px)
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await page.reload({ waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-e-owner-maintenance-mobile.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner/maintenance (Mobile)");

  // Reset desktop metrics
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 3. Tenant Support Portal (Desktop)
  await page.goto("http://localhost:3008/portal/support", { waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-e-tenant-support-desktop.png",
    fullPage: true,
  });
  console.log("Captured /portal/support (Desktop)");

  // 4. Tenant Support Portal (Mobile 390px)
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await page.reload({ waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-e-tenant-support-mobile.png",
    fullPage: true,
  });
  console.log("Captured /portal/support (Mobile)");

  // Reset desktop metrics
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 5. Kannada Localization on Maintenance Hub
  await page.goto("http://localhost:3008/dashboard/owner/maintenance", { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("rentpilot_locale", "kn");
  });
  await page.reload({ waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-e-kannada-localization.png",
    fullPage: true,
  });
  console.log("Captured Kannada localization on /dashboard/owner/maintenance");

  await task.finish({ keep: [] });
  console.log("Stage E visual capture complete!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
