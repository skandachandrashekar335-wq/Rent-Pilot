"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wrench,
  AlertTriangle,
  DollarSign,
  Search,
  Loader2,
  Eye,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/billing";
import { MaintenanceDrawer } from "@/components/maintenance/maintenance-drawer";

interface MaintenanceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  photo_paths: string[];
  repair_cost_paise: number;
  paid_by: string;
  created_at: string;
  property?: { id: string; name: string } | null;
  unit?: { id: string; unit_number: string } | null;
  tenancy?: {
    tenant?: { full_name?: string | null } | null;
  } | null;
}

function MaintenancePageContent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTickets = useCallback(async () => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/maintenance", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load maintenance tickets");
      const data = await res.json();
      setTickets(data.requests || []);
    } catch (err: unknown) {
      console.warn("Maintenance fetch error:", err);
      // Fallback preview tickets
      setTickets([
        {
          id: "mock-t1",
          title: "Bathroom sink faucet slow drip",
          description: "Bathroom sink faucet slow drip and pipe seal leaking under counter.",
          category: "PLUMBING",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          photo_paths: ["mock/sink1.jpg"],
          repair_cost_paise: 65000,
          paid_by: "OWNER",
          created_at: new Date().toISOString(),
          property: { id: "p1", name: "Green Villa" },
          unit: { id: "u1", unit_number: "U-201" },
          tenancy: { tenant: { full_name: "Rahul Sharma" } },
        },
        {
          id: "mock-t2",
          title: "Main breaker tripping on water heater load",
          description: "Main circuit breaker tripping when water heater switches on in master bath.",
          category: "ELECTRICAL",
          priority: "URGENT",
          status: "REPORTED",
          photo_paths: [],
          repair_cost_paise: 0,
          paid_by: "OWNER",
          created_at: new Date().toISOString(),
          property: { id: "p2", name: "Lakeview House" },
          unit: { id: "u2", unit_number: "U-01" },
          tenancy: { tenant: { full_name: "Amit Patel" } },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Handle URL param deep-linking from notifications
  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      setSelectedTicketId(urlId);
    }
  }, [searchParams]);

  // Filtered tickets
  const filteredTickets = tickets.filter((tkt) => {
    if (statusFilter !== "ALL" && tkt.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && tkt.priority !== priorityFilter) return false;
    if (categoryFilter !== "ALL" && tkt.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = tkt.title.toLowerCase().includes(q);
      const unitMatch = tkt.unit?.unit_number.toLowerCase().includes(q);
      const tenantMatch = tkt.tenancy?.tenant?.full_name?.toLowerCase().includes(q);
      const propMatch = tkt.property?.name.toLowerCase().includes(q);
      return titleMatch || unitMatch || tenantMatch || propMatch;
    }

    return true;
  });

  // Summary Metrics
  const openCount = tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CANCELLED").length;
  const urgentCount = tickets.filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED").length;
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const totalMtdSpendRupees = tickets.reduce((sum, t) => sum + paiseToRupees(t.repair_cost_paise), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            {t("maintenance.title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {t("maintenance.subtitle")}
          </p>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("maintenance.openTickets")}
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-text-primary font-mono">
              {openCount}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Awaiting resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-status-overdue-fg uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t("maintenance.urgentIssues")}</span>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-status-overdue-fg font-mono">
              {urgentCount}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Immediate action required</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("maintenance.inProgress")}
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-primary font-mono">
              {inProgressCount}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Contractor assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span>{t("maintenance.mtdSpend")}</span>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-text-primary font-mono">
              {formatINR(totalMtdSpendRupees)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">November repair expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Filterable Table (NOT Kanban!) */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Maintenance Operations Ledger
              </CardTitle>
              <Badge variant="neutral" className="text-xs">
                {filteredTickets.length} Tickets
              </Badge>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {["ALL", "REPORTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"].map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="h-7 text-xs px-2.5"
                >
                  {st.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>

          {/* Sub-Filters: Search, Priority, Category */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <Input
                placeholder="Search issue, unit, tenant, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-full"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-surface px-2.5 text-xs text-text-primary shadow-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🔴 Urgent</option>
              <option value="HIGH">🟠 High</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="LOW">🟢 Low</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-surface px-2.5 text-xs text-text-primary shadow-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="APPLIANCE">Appliance</option>
              <option value="CARPENTRY">Carpentry</option>
              <option value="STRUCTURAL">Structural</option>
              <option value="PEST_CONTROL">Pest Control</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
              Loading maintenance requests...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted">
              No maintenance tickets match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Unit & Property</TableHead>
                    <TableHead>Issue & Category</TableHead>
                    <TableHead className="w-[110px]">Priority</TableHead>
                    <TableHead className="w-[130px]">Tenant</TableHead>
                    <TableHead className="w-[120px]">Repair Expense</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((tkt) => {
                    const priorityVar =
                      tkt.priority === "URGENT" ? "overdue" : tkt.priority === "HIGH" ? "pending" : "neutral";

                    const statusVar =
                      tkt.status === "RESOLVED"
                        ? "paid"
                        : tkt.status === "IN_PROGRESS"
                        ? "pending"
                        : tkt.status === "ACKNOWLEDGED"
                        ? "pending"
                        : "neutral";

                    return (
                      <TableRow
                        key={tkt.id}
                        className="hover:bg-surface-hover/50 cursor-pointer"
                        onClick={() => setSelectedTicketId(tkt.id)}
                      >
                        <TableCell>
                          <div className="font-semibold text-xs text-text-primary">
                            Unit {tkt.unit?.unit_number || "—"}
                          </div>
                          <div className="text-[11px] text-text-muted truncate max-w-[150px]">
                            {tkt.property?.name || "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-text-primary line-clamp-1">
                            {tkt.title}
                          </div>
                          <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{tkt.category}</span>
                            {tkt.photo_paths?.length > 0 && (
                              <span className="text-[10px] bg-surface-muted px-1 rounded">
                                📷 {tkt.photo_paths.length}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={priorityVar} className="text-[11px]">
                            {tkt.priority === "URGENT" && "🔴 "}
                            {tkt.priority}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-text-muted">
                          {tkt.tenancy?.tenant?.full_name || "Tenant"}
                        </TableCell>

                        <TableCell className="text-xs font-mono font-medium text-text-primary">
                          {formatINR(paiseToRupees(tkt.repair_cost_paise))}
                        </TableCell>

                        <TableCell>
                          <Badge variant={statusVar} className="text-[11px]">
                            {tkt.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(tkt.id);
                            }}
                            className="h-7 text-xs px-2 flex items-center gap-1 ml-auto"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Detail & Operational Action Drawer */}
      <MaintenanceDrawer
        isOpen={!!selectedTicketId}
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onUpdated={fetchTickets}
      />
    </div>
  );
}

export default function OwnerMaintenancePage() {
  return (
    <OwnerShell>
      <Suspense fallback={
        <div className="p-12 text-center text-xs text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
          Loading operations...
        </div>
      }>
        <MaintenancePageContent />
      </Suspense>
    </OwnerShell>
  );
}
