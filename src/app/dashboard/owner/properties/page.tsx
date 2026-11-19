"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Users, Calendar, TrendingUp, UserPlus, LogOut, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/rent-increments";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { AddUnitDialog } from "@/components/properties/add-unit-dialog";
import { CreateTenancyDialog } from "@/components/properties/create-tenancy-dialog";
import { ApplyIncrementDialog } from "@/components/properties/apply-increment-dialog";
import { EndTenancyDialog } from "@/components/properties/end-tenancy-dialog";
import { authFetch } from "@/lib/api-client";

interface UnitData {
  id: string;
  unit_number: string;
  floor_number: number | null;
  configuration_label: string;
  bedrooms: number;
  bathrooms: number;
  has_parking: boolean;
  base_rent_paise: number;
  security_deposit_paise: number;
  occupancy_status: "OCCUPIED" | "VACANT" | "MAINTENANCE";
  activeTenancy?: {
    id: string;
    tenant_name: string;
    monthly_rent_paise: number;
    start_date: string;
    increment_schedule?: string | null;
  } | null;
}

interface PropertyData {
  id: string;
  name: string;
  property_type: string;
  address_line: string;
  city: string;
  total_floors: number;
  facilities: string[];
  units: UnitData[];
}

export default function PropertiesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State Handlers
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [addUnitState, setAddUnitState] = useState<{ isOpen: boolean; propertyId: string; propertyName: string }>({
    isOpen: false,
    propertyId: "",
    propertyName: "",
  });
  const [assignTenantState, setAssignTenantState] = useState<{
    isOpen: boolean;
    unitId: string;
    unitCode: string;
    propertyName: string;
    defaultRent: number;
    defaultDeposit: number;
  }>({
    isOpen: false,
    unitId: "",
    unitCode: "",
    propertyName: "",
    defaultRent: 18000,
    defaultDeposit: 100000,
  });
  const [incrementState, setIncrementState] = useState<{
    isOpen: boolean;
    tenancyId: string;
    unitCode: string;
    tenantName: string;
    currentRent: number;
  }>({
    isOpen: false,
    tenancyId: "",
    unitCode: "",
    tenantName: "",
    currentRent: 18000,
  });
  const [endTenancyState, setEndTenancyState] = useState<{
    isOpen: boolean;
    tenancyId: string;
    unitCode: string;
    tenantName: string;
  }>({
    isOpen: false,
    tenancyId: "",
    unitCode: "",
    tenantName: "",
  });

  const fetchPropertiesData = useCallback(async () => {
    try {
      if (!user) {
        setProperties([]);
        setLoading(false);
        return;
      }

      const [propsRes, tenanciesRes] = await Promise.all([
        authFetch("/api/properties"),
        authFetch("/api/tenancies"),
      ]);

      if (!propsRes.ok) {
        const errJson = await propsRes.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to load properties");
      }

      const propsData = await propsRes.json();
      const tenanciesData = tenanciesRes.ok ? await tenanciesRes.json() : { tenancies: [] };

      const activeTenanciesMap = new Map();
      (tenanciesData.tenancies || []).forEach((t: {
        status: string;
        rent_increment_schedules?: Array<{ increment_value: number; next_increment_date: string }>;
        unit_id: string;
        id: string;
        tenant?: { full_name?: string };
        monthly_rent_paise: number;
        start_date: string;
      }) => {
        if (t.status === "ACTIVE" || t.status === "UPCOMING") {
          const schedule = t.rent_increment_schedules?.[0];
          activeTenanciesMap.set(t.unit_id, {
            id: t.id,
            tenant_name: t.tenant?.full_name || "Unknown Tenant",
            monthly_rent_paise: t.monthly_rent_paise,
            start_date: t.start_date,
            increment_schedule: schedule
              ? `${schedule.increment_value}% on ${new Date(schedule.next_increment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
              : null,
          });
        }
      });

      const loadedProps: PropertyData[] = (propsData.properties || []).map((p: {
        id: string;
        name: string;
        property_type: string;
        address_line: string;
        city: string;
        total_floors: number;
        facilities?: string[];
        units?: UnitData[];
      }) => ({
        id: p.id,
        name: p.name,
        property_type: p.property_type,
        address_line: p.address_line,
        city: p.city,
        total_floors: p.total_floors,
        facilities: p.facilities || [],
        units: (p.units || []).map((u: UnitData) => ({
          ...u,
          activeTenancy: activeTenanciesMap.get(u.id) || null,
        })),
      }));

      setProperties(loadedProps);
    } catch (err: unknown) {
      console.warn("[Properties] Fetch error:", err);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPropertiesData();
  }, [fetchPropertiesData]);

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {t("common.properties")} & Units
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Manage residential houses, rental units, tenant contracts, and scheduled increments.
            </p>
          </div>

          <Button size="sm" onClick={() => setAddPropertyOpen(true)} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Add Property</span>
          </Button>
        </div>

        {/* Properties Listing */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-text-muted font-mono">Loading property and unit records...</p>
          </div>
        ) : properties.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">No Properties Configured</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                Begin by adding your first residential house or building to configure units and onboard tenants.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddPropertyOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Property
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {properties.map((prop) => {
              const totalUnits = prop.units.length;
              const occupiedUnits = prop.units.filter((u) => u.occupancy_status === "OCCUPIED").length;

              return (
                <Card key={prop.id} className="overflow-hidden">
                  <CardHeader className="bg-surface-muted/50 border-b border-border py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{prop.name}</CardTitle>
                          <Badge variant="outline" className="text-[11px]">
                            {prop.property_type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          {prop.address_line}, {prop.city} · {prop.total_floors} Floors
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-text-muted bg-surface px-3 py-1.5 rounded-md border border-border">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span className="font-mono font-medium text-text-primary">
                            {occupiedUnits} / {totalUnits}
                          </span>
                          <span>Units Occupied</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setAddUnitState({
                              isOpen: true,
                              propertyId: prop.id,
                              propertyName: prop.name,
                            })
                          }
                          className="h-8 text-xs flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Unit</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {prop.units.length === 0 ? (
                      <div className="p-6 text-center text-xs text-text-muted">
                        No units added to this property yet. Click &quot;Add Unit&quot; above to configure floors and rents.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Unit Code</TableHead>
                              <TableHead>Floor / Layout</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Active Tenant</TableHead>
                              <TableHead className="text-right">Monthly Rent</TableHead>
                              <TableHead>Increment Schedule</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {prop.units.map((unit) => {
                              const rentPaise = unit.activeTenancy
                                ? unit.activeTenancy.monthly_rent_paise
                                : unit.base_rent_paise;
                              const rentRupees = paiseToRupees(rentPaise);
                              const depositRupees = paiseToRupees(unit.security_deposit_paise);

                              return (
                                <TableRow key={unit.id}>
                                  <TableCell className="font-mono font-semibold text-text-primary">
                                    {unit.unit_number}
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-xs">
                                      <span className="font-medium text-text-primary">
                                        {unit.configuration_label}
                                      </span>
                                      <span className="text-text-muted ml-1.5">
                                        (Floor {unit.floor_number ?? "G"})
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-text-muted">
                                      {unit.bedrooms} Bed · {unit.bathrooms} Bath
                                      {unit.has_parking && " · Parking"}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        unit.occupancy_status === "OCCUPIED"
                                          ? "paid"
                                          : unit.occupancy_status === "VACANT"
                                          ? "pending"
                                          : "overdue"
                                      }
                                    >
                                      {unit.occupancy_status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {unit.activeTenancy ? (
                                      <div>
                                        <div className="text-xs font-medium text-text-primary">
                                          {unit.activeTenancy.tenant_name}
                                        </div>
                                        <div className="text-[11px] text-text-muted">
                                          Since {new Date(unit.activeTenancy.start_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-text-muted italic">Vacant</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium text-text-primary">
                                    {formatINR(rentRupees)}
                                  </TableCell>
                                  <TableCell>
                                    {unit.activeTenancy?.increment_schedule ? (
                                      <div className="flex items-center gap-1.5 text-xs text-text-primary">
                                        <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <span>{unit.activeTenancy.increment_schedule}</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-text-muted">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {unit.occupancy_status === "VACANT" ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs flex items-center gap-1"
                                        onClick={() =>
                                          setAssignTenantState({
                                            isOpen: true,
                                            unitId: unit.id,
                                            unitCode: unit.unit_number,
                                            propertyName: prop.name,
                                            defaultRent: rentRupees,
                                            defaultDeposit: depositRupees,
                                          })
                                        }
                                      >
                                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                                        <span>Assign Tenant</span>
                                      </Button>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 text-xs flex items-center gap-1 text-primary hover:text-primary"
                                          onClick={() =>
                                            setIncrementState({
                                              isOpen: true,
                                              tenancyId: unit.activeTenancy!.id,
                                              unitCode: unit.unit_number,
                                              tenantName: unit.activeTenancy!.tenant_name,
                                              currentRent: rentRupees,
                                            })
                                          }
                                        >
                                          <TrendingUp className="h-3.5 w-3.5" />
                                          <span>Increment</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 text-xs text-status-overdue-fg hover:text-status-overdue-fg hover:bg-status-overdue-bg"
                                          onClick={() =>
                                            setEndTenancyState({
                                              isOpen: true,
                                              tenancyId: unit.activeTenancy!.id,
                                              unitCode: unit.unit_number,
                                              tenantName: unit.activeTenancy!.tenant_name,
                                            })
                                          }
                                        >
                                          <LogOut className="h-3.5 w-3.5" />
                                          <span>End</span>
                                        </Button>
                                      </div>
                                    )}
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
              );
            })}
          </div>
        )}

        {/* Dialogs */}
        <AddPropertyDialog
          isOpen={addPropertyOpen}
          onClose={() => setAddPropertyOpen(false)}
          onSuccess={fetchPropertiesData}
        />

        <AddUnitDialog
          isOpen={addUnitState.isOpen}
          propertyId={addUnitState.propertyId}
          propertyName={addUnitState.propertyName}
          onClose={() => setAddUnitState({ isOpen: false, propertyId: "", propertyName: "" })}
          onSuccess={fetchPropertiesData}
        />

        <CreateTenancyDialog
          isOpen={assignTenantState.isOpen}
          unitId={assignTenantState.unitId}
          unitCode={assignTenantState.unitCode}
          propertyName={assignTenantState.propertyName}
          defaultRentRupees={assignTenantState.defaultRent}
          defaultDepositRupees={assignTenantState.defaultDeposit}
          onClose={() =>
            setAssignTenantState({
              isOpen: false,
              unitId: "",
              unitCode: "",
              propertyName: "",
              defaultRent: 18000,
              defaultDeposit: 100000,
            })
          }
          onSuccess={fetchPropertiesData}
        />

        <ApplyIncrementDialog
          isOpen={incrementState.isOpen}
          tenancyId={incrementState.tenancyId}
          unitCode={incrementState.unitCode}
          tenantName={incrementState.tenantName}
          currentRentRupees={incrementState.currentRent}
          onClose={() =>
            setIncrementState({
              isOpen: false,
              tenancyId: "",
              unitCode: "",
              tenantName: "",
              currentRent: 18000,
            })
          }
          onSuccess={fetchPropertiesData}
        />

        <EndTenancyDialog
          isOpen={endTenancyState.isOpen}
          tenancyId={endTenancyState.tenancyId}
          unitCode={endTenancyState.unitCode}
          tenantName={endTenancyState.tenantName}
          onClose={() =>
            setEndTenancyState({
              isOpen: false,
              tenancyId: "",
              unitCode: "",
              tenantName: "",
            })
          }
          onSuccess={fetchPropertiesData}
        />
      </div>
    </OwnerShell>
  );
}
