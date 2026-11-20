import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pnbtexouxvlurtvphzpz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== CLEANING SUPABASE DATABASE STATE ===");

  // 1. Delete dependent tables first
  console.log("Purging maintenance tickets...");
  await supabase.from("maintenance_tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging meter readings...");
  await supabase.from("meter_readings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging payment submissions...");
  await supabase.from("payment_submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging offline payments...");
  await supabase.from("offline_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging invoices...");
  await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging scheduled increments...");
  await supabase.from("scheduled_increments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging tenant invitations...");
  await supabase.from("tenant_invitations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging tenancies...");
  await supabase.from("tenancies").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging units...");
  await supabase.from("units").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Purging properties...");
  await supabase.from("properties").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 2. Setup Profiles for allowlisted emails
  console.log("\nEnsuring profiles for allowlisted admins...");
  const adminEmails = ["skandachandrashekar335@gmail.com", "chandraskekar335@gmail.com"];
  const profileMap: Record<string, string> = {};

  for (const email of adminEmails) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log(`Profile exists for ${email}: ${existing.id}`);
      profileMap[email] = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("profiles")
        .insert({
          email,
          firebase_uid: `manual-admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          full_name: email.split("@")[0],
          preferred_locale: "en",
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to create profile for ${email}:`, error);
      } else {
        console.log(`Created profile for ${email}: ${created.id}`);
        profileMap[email] = created.id;
      }
    }
  }

  const primaryProfileId = profileMap["skandachandrashekar335@gmail.com"];
  if (!primaryProfileId) {
    throw new Error("Could not find or create primary admin profile");
  }

  // 3. Setup Organization "Shekar Homes"
  console.log("\nEnsuring Shekar Homes organization...");
  let orgId = "";
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id, name, owner_profile_id")
    .eq("name", "Shekar Homes")
    .maybeSingle();

  if (!existingOrg) {
    const { data: createdOrg, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: "Shekar Homes",
        owner_profile_id: primaryProfileId,
        billing_day_of_month: 1,
        currency: "INR",
        timezone: "Asia/Kolkata",
      })
      .select()
      .single();
    if (orgErr || !createdOrg) throw orgErr || new Error("Failed to create org");
    orgId = createdOrg.id;
    console.log(`Created Shekar Homes org: ${orgId}`);
  } else {
    orgId = existingOrg.id;
    await supabase
      .from("organizations")
      .update({ owner_profile_id: primaryProfileId })
      .eq("id", orgId);
    console.log(`Using Shekar Homes org: ${orgId}`);
  }

  // Delete other organizations
  await supabase
    .from("organizations")
    .delete()
    .neq("id", orgId);

  // 4. Update organization_memberships
  console.log("\nUpdating organization memberships...");
  await supabase
    .from("organization_memberships")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  for (const email of adminEmails) {
    const pId = profileMap[email];
    if (pId) {
      const { error: memErr } = await supabase
        .from("organization_memberships")
        .insert({
          organization_id: orgId,
          profile_id: pId,
          role: "OWNER",
          status: "ACTIVE",
        });
      if (memErr) console.error(`Error adding membership for ${email}:`, memErr);
      else console.log(`Linked ${email} to Shekar Homes as OWNER`);
    }
  }

  // 5. Verify counts
  console.log("\n=== VERIFYING FINAL COUNTS ===");
  const { count: propCount } = await supabase.from("properties").select("*", { count: "exact", head: true });
  const { count: unitCount } = await supabase.from("units").select("*", { count: "exact", head: true });
  const { count: tenCount } = await supabase.from("tenancies").select("*", { count: "exact", head: true });
  const { count: invCount } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  const { data: activeOrgs } = await supabase.from("organizations").select("id, name, owner_profile_id");
  const { data: activeMembers } = await supabase.from("organization_memberships").select("id, organization_id, profile_id, role, status");

  console.log(`Properties count: ${propCount}`);
  console.log(`Units count:      ${unitCount}`);
  console.log(`Tenancies count:  ${tenCount}`);
  console.log(`Invoices count:   ${invCount}`);
  console.log("Active Organizations:", activeOrgs);
  console.log("Active Memberships:", activeMembers);

  if (propCount === 0 && unitCount === 0 && tenCount === 0 && invCount === 0) {
    console.log("\n✓ SUCCESS: Database cleanly reset with zero test data and both admins linked to Shekar Homes!");
  } else {
    console.error("\n✗ WARNING: Some tables still have non-zero counts.");
  }
}

run().catch((err) => {
  console.error("Purge script failed:", err);
  process.exit(1);
});
