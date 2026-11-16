import React from "react";
import { TenantGuard } from "@/components/auth/tenant-guard";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantGuard>{children}</TenantGuard>;
}
