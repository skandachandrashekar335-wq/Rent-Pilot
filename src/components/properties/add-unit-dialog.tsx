"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Home, X, AlertCircle, Loader2 } from "lucide-react";
import { isValidUuid } from "@/lib/utils";

interface AddUnitDialogProps {
  isOpen: boolean;
  propertyId: string;
  propertyName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUnitDialog({
  isOpen,
  propertyId,
  propertyName,
  onClose,
  onSuccess,
}: AddUnitDialogProps) {
  const { user, activeOrganization } = useAuth();
  const [unitNumber, setUnitNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState<number | "">(0);
  const [configLabel, setConfigLabel] = useState("2BHK");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [hasParking, setHasParking] = useState(true);
  const [baseRent, setBaseRent] = useState(18000);
  const [securityDeposit, setSecurityDeposit] = useState(100000);
  const [facilities, setFacilities] = useState("Geyser, Balcony, Separate BESCOM Meter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();

      const facilityList = facilities
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await fetch("/api/units", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: isValidUuid(activeOrganization?.id) ? activeOrganization?.id : undefined,
          propertyId,
          unitNumber: unitNumber.trim(),
          floorNumber: floorNumber === "" ? null : Number(floorNumber),
          configurationLabel: configLabel.trim(),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          hasParking,
          facilities: facilityList,
          baseRentRupees: Number(baseRent),
          securityDepositRupees: Number(securityDeposit),
          occupancyStatus: "VACANT",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create unit");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create unit");
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
              <Home className="h-5 w-5 text-primary" />
              <span>Add Rental Unit — {propertyName}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Add a floor unit with bedroom specifications, base rent, and deposit terms.
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Unit Number/Code <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  placeholder="e.g. U-101 or 1A"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Floor Number (0 = Ground)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value === "" ? "" : Number(e.target.value))}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">Layout</label>
                <select
                  value={configLabel}
                  onChange={(e) => setConfigLabel(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-surface px-2.5 py-1 text-xs text-text-primary shadow-xs focus-visible:outline-xs focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="1RK">1 RK</option>
                  <option value="1BHK">1 BHK</option>
                  <option value="2BHK">2 BHK</option>
                  <option value="3BHK">3 BHK</option>
                  <option value="4BHK">4 BHK</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">Bedrooms</label>
                <Input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">Bathrooms</label>
                <Input
                  type="number"
                  min={1}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Base Monthly Rent (₹) <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={baseRent}
                  onChange={(e) => setBaseRent(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Security Deposit (₹)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="hasParking"
                checked={hasParking}
                onChange={(e) => setHasParking(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <label htmlFor="hasParking" className="text-xs font-medium text-text-primary">
                Dedicated Parking Slot Included
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Unit Amenities / Specifications
              </label>
              <Input
                placeholder="Geyser, Balcony, Separate BESCOM Meter, Wardrobe"
                value={facilities}
                onChange={(e) => setFacilities(e.target.value)}
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
                  "Create Unit"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
