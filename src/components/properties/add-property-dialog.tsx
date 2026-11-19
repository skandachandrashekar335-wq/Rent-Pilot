"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, X, AlertCircle, Loader2 } from "lucide-react";
import { isValidUuid } from "@/lib/utils";
import { authFetch } from "@/lib/api-client";

interface AddPropertyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPropertyDialog({ isOpen, onClose, onSuccess }: AddPropertyDialogProps) {
  const { user, activeOrganization } = useAuth();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("INDEPENDENT_HOUSE");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560038");
  const [totalFloors, setTotalFloors] = useState(2);
  const [facilities, setFacilities] = useState("Borewell Water, Rainwater Harvesting, CCTV");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");

      const facilityList = facilities
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await authFetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: isValidUuid(activeOrganization?.id) ? activeOrganization?.id : undefined,
          name: name.trim(),
          propertyType,
          addressLine: addressLine.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          totalFloors: Number(totalFloors),
          facilities: facilityList,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create property");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create property");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="max-w-lg w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Add New Property</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configure an independent house, apartment building, or commercial property.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Property Name <span className="text-status-overdue-fg">*</span>
              </label>
              <Input
                placeholder="e.g. Sunrise Enclave or Lakeview House"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-xs text-text-primary shadow-xs focus-visible:outline-xs focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="INDEPENDENT_HOUSE">Independent House</option>
                  <option value="APARTMENT_BUILDING">Apartment Building</option>
                  <option value="COMMERCIAL">Commercial Property</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Total Floors
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Address Line <span className="text-status-overdue-fg">*</span>
              </label>
              <Input
                placeholder="e.g. 14th Cross, 2nd Main, Indiranagar"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} required className="text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">State</label>
                <Input value={state} onChange={(e) => setState(e.target.value)} required className="text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">Pincode</label>
                <Input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Common Facilities (Comma separated)
              </label>
              <Input
                placeholder="Borewell, CCTV, Solar Water, Power Backup"
                value={facilities}
                onChange={(e) => setFacilities(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Internal Notes (Optional)
              </label>
              <Input
                placeholder="Key locations, meter cabinet numbers, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  "Create Property"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
