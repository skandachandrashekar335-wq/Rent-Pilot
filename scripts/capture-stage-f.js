async function main() {
  const task = await taskSpace("stage-f-capture");
  const page = task.page("p1");

  console.log("Capturing Stage F views on port 3009...");

  // 1. Owner Dashboard Overview (Desktop)
  await page.goto("http://localhost:3009/dashboard/owner", { waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-f-owner-overview-desktop.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner (Desktop)");

  // 2. Owner Dashboard Overview (Mobile 390px)
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await page.reload({ waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-f-owner-overview-mobile.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner (Mobile 390px)");

  // Reset desktop metrics
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 3. Tenant Portal (Desktop)
  await page.goto("http://localhost:3009/portal", { waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-f-tenant-portal-desktop.png",
    fullPage: true,
  });
  console.log("Captured /portal (Desktop)");

  // 4. Tenant Support (Desktop)
  await page.goto("http://localhost:3009/portal/support", { waitUntil: "load" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-f-tenant-support-desktop.png",
    fullPage: true,
  });
  console.log("Captured /portal/support (Desktop)");

  console.log("Stage F visual capture complete.");
}

main().catch(console.error);

