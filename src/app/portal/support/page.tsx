"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";

interface TenantMaintenanceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  photo_paths: string[];
  created_at: string;
  unit?: { unit_number: string } | null;
  property?: { name: string } | null;
}

interface UpdateItem {
  id: string;
  comment: string;
  created_at: string;
  actor?: { full_name?: string | null } | null;
}

function TenantSupportContent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<TenantMaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketUpdates, setTicketUpdates] = useState<Record<string, UpdateItem[]>>({});
  const [ticketPhotos, setTicketPhotos] = useState<Record<string, Array<{ path: string; signedUrl: string }>>>({});

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("PLUMBING");
  const [priority, setPriority] = useState("MEDIUM");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cancellation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      if (!user) throw new Error("Demo preview mode");
      const token = await user.getIdToken();
      const res = await fetch("/api/maintenance", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load maintenance requests");
      const data = await res.json();
      setTickets(data.requests || []);
    } catch (err: unknown) {
      console.warn("Tenant maintenance fetch warning:", err);
      // Mock fallback for preview
      setTickets([
        {
          id: "mock-t1",
          title: "Bathroom sink faucet slow drip",
          description: "Bathroom sink faucet slow drip and pipe seal leaking under counter.",
          category: "PLUMBING",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          photo_paths: [],
          created_at: new Date().toISOString(),
          unit: { unit_number: "U-201" },
          property: { name: "Green Villa" },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Handle URL param deep-linking
  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      setExpandedTicketId(urlId);
    }
  }, [searchParams]);

  // Expand ticket details
  const handleToggleExpand = async (ticketId: string) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }

    setExpandedTicketId(ticketId);

    if (!ticketUpdates[ticketId] && user) {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/maintenance/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setTicketUpdates((prev) => ({ ...prev, [ticketId]: data.updates || [] }));
          setTicketPhotos((prev) => ({ ...prev, [ticketId]: data.signedPhotos || [] }));
        }
      } catch (err) {
        console.warn("Failed to fetch ticket timeline:", err);
      }
    }
  };

  // Photo file selection handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFormError(null);

    const files = Array.from(e.target.files);
    if (photoFiles.length + files.length > 4) {
      setFormError("Maximum 4 photos allowed per maintenance request.");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    for (const f of files) {
      if (!validTypes.includes(f.type)) {
        setFormError(`File ${f.name} is not an accepted image format (JPEG, PNG, WebP only).`);
        return;
      }
      if (f.size > 5242880) {
        setFormError(`File ${f.name} exceeds the 5 MB maximum size limit.`);
        return;
      }
    }

    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const token = await user.getIdToken();

      // 1. Upload photos if any
      const uploadedPaths: string[] = [];
      for (const file of photoFiles) {
        const presignRes = await fetch("/api/storage/maintenance/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
          }),
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json();
          throw new Error(errData.error || `Failed to initiate upload for ${file.name}`);
        }

        const { signedUrl, storagePath } = await presignRes.json();

        // Direct upload to Supabase storage signed URL
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        uploadedPaths.push(storagePath);
      }

      // 2. Create maintenance ticket
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          photoPaths: uploadedPaths,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit maintenance request");
      }

      // Reset form
      setTitle("");
      setDescription("");
      setPhotoFiles([]);
      setShowForm(false);
      setSuccessMessage("Maintenance request submitted successfully! Your landlord has been notified.");
      fetchTickets();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error submitting request");
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel request (only allowed if REPORTED)
  const handleCancelTicket = async (ticketId: string) => {
    if (!user) return;
    setCancellingId(ticketId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/maintenance/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "CANCELLED",
          comment: "Request cancelled by tenant.",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to cancel ticket");
      } else {
        fetchTickets();
      }
    } catch (err) {
      console.warn("Cancel ticket error:", err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {t("common.support")} & Maintenance
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Submit repair requests with photos directly to your landlord.
          </p>
        </div>

        {!showForm && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="text-xs h-8 flex items-center gap-1.5"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{t("maintenance.newRequest")}</span>
          </Button>
        )}
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-status-paid-bg text-status-paid-fg text-xs font-medium flex items-center gap-2 border border-status-paid-fg/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Ticket Submission Form Card */}
      {showForm && (
        <Card className="border-primary/40 shadow-sm animate-in fade-in-50 duration-150">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span>{t("maintenance.newRequest")}</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowForm(false)}
              className="h-7 w-7 text-text-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <form onSubmit={handleSubmitTicket} className="space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded bg-status-overdue-bg text-status-overdue-fg text-xs flex items-center gap-1.5 border border-status-overdue-fg/20">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    {t("maintenance.category")} <span className="text-status-overdue-fg">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-surface px-2.5 text-xs text-text-primary shadow-xs"
                    required
                  >
                    <option value="PLUMBING">Plumbing (Taps, pipes, leakage)</option>
                    <option value="ELECTRICAL">Electrical (Switch, breaker, fan)</option>
                    <option value="APPLIANCE">Appliance (Geyser, AC)</option>
                    <option value="CARPENTRY">Carpentry (Doors, locks, hinges)</option>
                    <option value="STRUCTURAL">Structural (Seepage, wall, paint)</option>
                    <option value="PEST_CONTROL">Pest Control</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    {t("maintenance.priority")}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-surface px-2.5 text-xs text-text-primary shadow-xs"
                  >
                    <option value="LOW">🟢 Low (Minor aesthetic / upkeep)</option>
                    <option value="MEDIUM">🟡 Medium (Normal repair)</option>
                    <option value="HIGH">🟠 High (Impacting daily use)</option>
                    <option value="URGENT">🔴 Urgent (Hazard / Water leak / Power outage)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Issue Summary <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  placeholder="e.g. Bathroom sink pipe leaking under counter"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Detailed Description <span className="text-status-overdue-fg">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Please describe exactly what is broken, when it started, and location..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-surface p-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                />
              </div>

              {/* Photo Upload Section */}
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Attach Photos (Up to 4 · Max 5 MB each)
                </label>

                {photoFiles.length < 4 && (
                  <label className="border border-dashed border-border hover:border-primary/60 rounded-lg p-3.5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-surface-muted/20">
                    <Upload className="h-5 w-5 text-text-muted mb-1" />
                    <span className="text-xs font-medium text-text-primary">Click to select photo</span>
                    <span className="text-[11px] text-text-muted">JPEG, PNG, or WebP</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Thumbnails */}
                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {photoFiles.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded border border-border bg-black/10 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Upload preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-black"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="text-xs h-8 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tenant Requests List */}
      <div className="space-y-3 pt-1">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Your Maintenance Requests ({tickets.length})
        </span>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
            Loading your maintenance tickets...
          </div>
        ) : tickets.length === 0 ? (
          <Card className="p-8 text-center text-xs text-text-muted">
            You have no reported maintenance requests.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {tickets.map((tkt) => {
              const isExpanded = expandedTicketId === tkt.id;
              const photos = ticketPhotos[tkt.id] || [];
              const updates = ticketUpdates[tkt.id] || [];

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
                <Card key={tkt.id} className="overflow-hidden border-border transition-all">
                  <div
                    onClick={() => handleToggleExpand(tkt.id)}
                    className="p-4 cursor-pointer hover:bg-surface-hover/40 flex items-center justify-between"
                  >
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">
                          {tkt.title}
                        </span>
                        <Badge variant={priorityVar} className="text-[10px] px-1.5 py-0">
                          {tkt.priority}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {tkt.category} · Reported on{" "}
                        {new Date(tkt.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusVar} className="text-[11px]">
                        {tkt.status}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3 bg-surface-muted/20 text-xs">
                      <div>
                        <span className="font-medium text-text-muted uppercase text-[10px] tracking-wider block mb-1">
                          Reported Description
                        </span>
                        <p className="text-text-primary bg-surface p-2.5 rounded border border-border/60 whitespace-pre-wrap leading-relaxed">
                          {tkt.description}
                        </p>
                      </div>

                      {/* Photo Previews */}
                      {photos.length > 0 && (
                        <div>
                          <span className="font-medium text-text-muted uppercase text-[10px] tracking-wider block mb-1">
                            Attached Photos ({photos.length})
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {photos.map((p, i) => (
                              <a
                                key={i}
                                href={p.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block aspect-square rounded border border-border overflow-hidden hover:opacity-90"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.signedUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Landlord Updates Timeline */}
                      <div>
                        <span className="font-medium text-text-muted uppercase text-[10px] tracking-wider block mb-1 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>Landlord Updates ({updates.length})</span>
                        </span>
                        {updates.length === 0 ? (
                          <p className="text-[11px] text-text-muted italic">
                            No updates posted yet. Landlord will review shortly.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {updates.map((u) => (
                              <div key={u.id} className="p-2.5 rounded bg-surface border border-border/60 text-xs">
                                <div className="flex items-center justify-between text-[11px] text-text-muted mb-0.5">
                                  <span className="font-semibold text-text-primary">
                                    {u.actor?.full_name || "Landlord"}
                                  </span>
                                  <span>
                                    {new Date(u.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-text-muted">{u.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cancel Button (Only if REPORTED) */}
                      {tkt.status === "REPORTED" && (
                        <div className="pt-2 border-t border-border/40 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancellingId === tkt.id}
                            onClick={() => handleCancelTicket(tkt.id)}
                            className="text-xs h-7 text-status-overdue-fg border-status-overdue-fg/30 hover:bg-status-overdue-bg"
                          >
                            {cancellingId === tkt.id ? "Cancelling..." : "Cancel Request"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TenantSupportPage() {
  return (
    <TenantShell>
      <Suspense fallback={
        <div className="p-8 text-center text-xs text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
          Loading support portal...
        </div>
      }>
        <TenantSupportContent />
      </Suspense>
    </TenantShell>
  );
}
