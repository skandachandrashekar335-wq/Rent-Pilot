"use client";

import React, { useState } from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

interface MaintenanceTicket {
  id: string;
  code: string;
  propertyUnit: string;
  tenantName: string;
  category: "Plumbing" | "Electrical" | "Structural" | "Appliance";
  description: string;
  urgency: "URGENT" | "NORMAL";
  costInr: number | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  submittedAt: string;
}

const mockTickets: MaintenanceTicket[] = [
  {
    id: "t-1",
    code: "TKT-108",
    propertyUnit: "Green Villa · U-201",
    tenantName: "Rahul Sharma",
    category: "Plumbing",
    description: "Bathroom sink faucet slow drip and pipe seal leaking under counter.",
    urgency: "NORMAL",
    costInr: 650,
    status: "IN_PROGRESS",
    submittedAt: "12 Nov 2026",
  },
  {
    id: "t-2",
    code: "TKT-107",
    propertyUnit: "Lakeview House · U-01",
    tenantName: "Amit Patel",
    category: "Electrical",
    description: "Main circuit breaker tripping when water heater switches on.",
    urgency: "URGENT",
    costInr: 1200,
    status: "RESOLVED",
    submittedAt: "08 Nov 2026",
  },
];

export default function MaintenancePage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState(mockTickets);

  const toggleStatus = (id: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status:
                t.status === "OPEN"
                  ? "IN_PROGRESS"
                  : t.status === "IN_PROGRESS"
                  ? "RESOLVED"
                  : "OPEN",
            }
          : t
      )
    );
  };

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {t("common.maintenance")} & Operations
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Track repair tickets, contractor expenses, and property upkeep history.
            </p>
          </div>
        </div>

        {/* Clean Ticket Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Wrench className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Service Tickets
              </CardTitle>
            </div>
            <span className="text-xs text-text-muted">
              {tickets.filter((t) => t.status !== "RESOLVED").length} Active Tickets
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Property & Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Issue Description</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Expense (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((tkt) => (
                  <TableRow key={tkt.id}>
                    <TableCell className="font-mono text-xs font-semibold text-text-primary">
                      {tkt.code}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-text-primary">
                      {tkt.propertyUnit}
                      <p className="text-[11px] text-text-muted">{tkt.tenantName}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="px-2 py-0.5 rounded bg-surface-muted text-text-muted border border-border/40">
                        {tkt.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted max-w-xs truncate">
                      {tkt.description}
                    </TableCell>
                    <TableCell>
                      {tkt.urgency === "URGENT" ? (
                        <Badge variant="overdue">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Urgent
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tkt.costInr ? formatINR(tkt.costInr) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tkt.status === "RESOLVED"
                            ? "paid"
                            : tkt.status === "IN_PROGRESS"
                            ? "pending"
                            : "outline"
                        }
                      >
                        {tkt.status === "RESOLVED" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {tkt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleStatus(tkt.id)}
                        className="text-xs"
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </OwnerShell>
  );
}
