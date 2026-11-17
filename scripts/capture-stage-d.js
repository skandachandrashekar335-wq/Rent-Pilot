async function main() {
  const task = await taskSpace("stage-d-capture");
  const page = task.page("p1");

  console.log("Capturing Stage D views...");

  // View 1: Owner Billing Ledger
  await page.goto("http://localhost:3008/dashboard/owner/billing", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-d-owner-billing.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner/billing");

  // View 2: Owner Action Center
  await page.goto("http://localhost:3008/dashboard/owner", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-d-owner-overview.png",
    fullPage: true,
  });
  console.log("Captured /dashboard/owner");

  // View 3: Tenant Portal Home
  await page.goto("http://localhost:3008/portal", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-d-tenant-portal.png",
    fullPage: true,
  });
  console.log("Captured /portal");

  // View 4: Tenant Portal History
  await page.goto("http://localhost:3008/portal/history", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "/Users/skandachandrashekar335/projects/Rent-Pilot/research/screenshots/stage-d-tenant-history.png",
    fullPage: true,
  });
  console.log("Captured /portal/history");

  await task.finish({ keep: [] });
  console.log("Stage D visual capture complete!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
