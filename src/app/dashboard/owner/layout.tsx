import React from "react";
import { OwnerGuard } from "@/components/auth/owner-guard";

export const dynamic = "force-dynamic";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OwnerGuard>{children}</OwnerGuard>;
}
