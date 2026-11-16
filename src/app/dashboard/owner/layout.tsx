import React from "react";
import { OwnerGuard } from "@/components/auth/owner-guard";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OwnerGuard>{children}</OwnerGuard>;
}
