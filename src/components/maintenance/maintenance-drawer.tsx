"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Lock,
  MessageSquare,
  Send,
  Eye,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

export interface MaintenanceTicketDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  photo_paths: string[];
  repair_cost_rupees: number;
  paid_by: string;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  property?: { id: string; name: string } | null;
  unit?: { id: string; unit_number: string; configuration_label?: string | null } | null;
  tenancy?: {
    id: string;
    tenant?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  } | null;
  reported_by?: { full_name?: string | null; email?: string | null } | null;
}

interface MaintenanceUpdate {
  id: string;
  actor_profile_id: string;
  previous_status?: string | null;
  new_status?: string | null;
  comment: string;
  is_internal_note: boolean;
  created_at: string;
  actor?: { full_name?: string | null; email?: string | null } | null;
}

interface SignedPhoto {
  path: string;
  signedUrl: string;
}

interface MaintenanceDrawerProps {
  isOpen: boolean;
  ticketId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function MaintenanceDrawer({
  isOpen,
  ticketId,
  onClose,
  onUpdated,
}: MaintenanceDrawerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<MaintenanceTicketDetail | null>(null);
  const [updates, setUpdates] = useState<MaintenanceUpdate[]>([]);
  const [signedPhotos, setSignedPhotos] = useState<SignedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [commentText, setCommentText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [repairCost, setRepairCost] = useState<number>(0);
  const [paidBy, setPaidBy] = useState<"OWNER" | "TENANT" | "SHARED">("OWNER");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !ticketId || !user) return;

    let isMounted = true;

    async function loadTicket() {
      setLoading(true);
      setError(null);
      try {
        const token = await user?.getIdToken();
        const res = await fetch(`/api/maintenance/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load maintenance ticket");
        const data = await res.json();

        if (isMounted) {
          setTicket(data.request);
          setUpdates(data.updates || []);
          setSignedPhotos(data.signedPhotos || []);
          setRepairCost(data.request.repair_cost_rupees || 0);
          setPaidBy(data.request.paid_by || "OWNER");
          setResolutionNotes(data.request.resolution_notes || "");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error loading ticket");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTicket();

    return () => {
      isMounted = false;
    };
  }, [isOpen, ticketId, user]);

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !user) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/maintenance/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          repairCostRupees: newStatus === "RESOLVED" ? repairCost : undefined,
          paidBy: newStatus === "RESOLVED" ? paidBy : undefined,
          resolutionNotes: newStatus === "RESOLVED" ? resolutionNotes : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update ticket status");
      }

      onUpdated();
      // Reload drawer data
      const updatedRes = await fetch(`/api/maintenance/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        setTicket(data.request);
        setUpdates(data.updates || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/maintenance/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repairCostRupees: repairCost,
          paidBy,
          resolutionNotes: resolutionNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save expenses");
      }

      onUpdated();
      const updatedRes = await fetch(`/api/maintenance/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        setTicket(data.request);
        setUpdates(data.updates || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving expenses");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || !commentText.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/maintenance/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment: commentText.trim(),
          isInternalNote,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add comment");
      }

      setCommentText("");
      setIsInternalNote(false);
      onUpdated();
      const updatedRes = await fetch(`/api/maintenance/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        setUpdates(data.updates || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error adding comment");
    } finally {
      setActionLoading(false);
    }
  };

  const priorityVariant =
    ticket?.priority === "URGENT" ? "overdue" : ticket?.priority === "HIGH" ? "pending" : "neutral";

  const statusVariant =
    ticket?.status === "RESOLVED"
      ? "paid"
      : ticket?.status === "IN_PROGRESS"
      ? "pending"
      : ticket?.status === "ACKNOWLEDGED"
      ? "pending"
      : "neutral";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-surface h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary leading-tight">
                {ticket?.title || t("maintenance.ticketDetails")}
              </h2>
              <span className="text-[11px] text-text-muted font-mono">
                Unit {ticket?.unit?.unit_number} · {ticket?.property?.name}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-xs text-text-muted space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p>Loading ticket details and timeline...</p>
            </div>
          ) : ticket ? (
            <>
              {error && (
                <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs flex items-center gap-2 border border-status-overdue-fg/20">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Status and Priority Pill Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-muted/40 rounded-lg border border-border/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted font-medium">{t("maintenance.status")}:</span>
                  <Badge variant={statusVariant}>{ticket.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted font-medium">{t("maintenance.priority")}:</span>
                  <Badge variant={priorityVariant}>
                    {ticket.priority === "URGENT" && "🔴 "}
                    {ticket.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted font-medium">{t("maintenance.category")}:</span>
                  <span className="font-semibold text-text-primary">{ticket.category}</span>
                </div>
              </div>

              {/* Tenant Issue Description (Verbatim) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Tenant Reported Issue
                </label>
                <div className="p-3.5 rounded-lg bg-surface-muted/20 border border-border/60 text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                  {ticket.description}
                </div>
                <p className="text-[11px] text-text-muted">
                  Reported by {ticket.tenancy?.tenant?.full_name || "Tenant"} on{" "}
                  {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Photos Gallery (15-min signed URLs) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
                  <span>{t("maintenance.photos")} ({signedPhotos.length})</span>
                  <span className="text-[10px] text-text-muted font-normal">Encrypted 15-min signed links</span>
                </label>

                {signedPhotos.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-lg text-xs text-text-muted">
                    {t("maintenance.noPhotos")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {signedPhotos.map((photo, idx) => (
                      <div
                        key={photo.path}
                        onClick={() => setSelectedPhoto(photo.signedUrl)}
                        className="group relative aspect-square rounded-md overflow-hidden border border-border bg-black/10 cursor-pointer hover:border-primary transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signedUrl}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Operational Quick Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Update Ticket Status
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={ticket.status === "ACKNOWLEDGED" ? "primary" : "outline"}
                    disabled={actionLoading || ticket.status === "RESOLVED"}
                    onClick={() => handleStatusChange("ACKNOWLEDGED")}
                    className="text-xs h-8"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {t("maintenance.acknowledge")}
                  </Button>
                  <Button
                    size="sm"
                    variant={ticket.status === "IN_PROGRESS" ? "primary" : "outline"}
                    disabled={actionLoading || ticket.status === "RESOLVED"}
                    onClick={() => handleStatusChange("IN_PROGRESS")}
                    className="text-xs h-8"
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1" />
                    {t("maintenance.startWork")}
                  </Button>
                  <Button
                    size="sm"
                    variant={ticket.status === "RESOLVED" ? "primary" : "outline"}
                    disabled={actionLoading || ticket.status === "RESOLVED"}
                    onClick={() => handleStatusChange("RESOLVED")}
                    className="text-xs h-8 bg-status-paid-fg text-white hover:bg-status-paid-fg/90 border-transparent"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {t("maintenance.markResolved")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading || ticket.status === "CANCELLED"}
                    onClick={() => handleStatusChange("CANCELLED")}
                    className="text-xs h-8 text-status-overdue-fg border-status-overdue-fg/30 hover:bg-status-overdue-bg"
                  >
                    {t("maintenance.cancelTicket")}
                  </Button>
                </div>
              </div>

              {/* Repair Expenses Section */}
              <form onSubmit={handleSaveExpenses} className="space-y-3 p-4 bg-surface-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span>Repair & Contractor Expenses</span>
                  </label>
                  <span className="text-[11px] text-text-muted font-mono">
                    Current: {formatINR(ticket.repair_cost_rupees || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">
                      {t("maintenance.cost")} (₹)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={repairCost}
                      onChange={(e) => setRepairCost(Number(e.target.value))}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">
                      {t("maintenance.paidBy")}
                    </label>
                    <select
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value as "OWNER" | "TENANT" | "SHARED")}
                      className="w-full h-8 rounded-md border border-input bg-surface px-2 text-xs text-text-primary shadow-xs"
                    >
                      <option value="OWNER">Owner (Operational Expense)</option>
                      <option value="TENANT">Tenant (Tenant Damage)</option>
                      <option value="SHARED">Shared (50/50)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    {t("maintenance.resolutionNotes")}
                  </label>
                  <Input
                    placeholder="e.g. Replaced faulty mixer tap, contractor invoice #428"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={actionLoading} className="text-xs h-7 px-3">
                    Save Expenses
                  </Button>
                </div>
              </form>

              {/* Updates Timeline */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{t("maintenance.timeline")} ({updates.length})</span>
                </label>

                <div className="space-y-2.5">
                  {updates.map((upd) => (
                    <Card
                      key={upd.id}
                      className={upd.is_internal_note ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"}
                    >
                      <CardContent className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-text-primary flex items-center gap-1">
                            {upd.is_internal_note && (
                              <Badge variant="pending" className="text-[10px] px-1 py-0 h-4">
                                <Lock className="h-2.5 w-2.5 mr-0.5" />
                                Internal
                              </Badge>
                            )}
                            {upd.actor?.full_name || "Staff"}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(upd.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-text-muted leading-relaxed">{upd.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Post New Comment or Internal Note */}
                <form onSubmit={handleAddComment} className="pt-2 space-y-2">
                  <div className="relative">
                    <textarea
                      rows={2}
                      placeholder="Add an update note or message..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      required
                      className="w-full rounded-md border border-input bg-surface p-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span className="flex items-center gap-1 text-[11px]">
                        <Lock className="h-3 w-3" />
                        Internal Landlord Note
                      </span>
                    </label>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={actionLoading || !commentText.trim()}
                      className="text-xs h-7 px-3 flex items-center gap-1"
                    >
                      <Send className="h-3 w-3" />
                      <span>Post Note</span>
                    </Button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-xs text-text-muted">
              Select a ticket to inspect details.
            </div>
          )}
        </div>

        {/* Photo Lightbox Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] bg-surface rounded-lg overflow-hidden border border-border shadow-2xl">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 text-white bg-black/60 rounded-full h-8 w-8 hover:bg-black/90"
              >
                <X className="h-4 w-4" />
              </Button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto}
                alt="Enlarged photo preview"
                className="max-h-[85vh] w-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
