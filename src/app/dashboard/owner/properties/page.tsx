"use client";

import React from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Users, Calendar } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

interface Unit {
  id: string;
  code: string;
  floor: string;
  type: string;
  tenantName: string | null;
  rentAmount: number;
  incrementSchedule: string | null;
  status: "OCCUPIED" | "VACANT" | "MAINTENANCE";
}

interface Property {
  id: string;
  name: string;
  address: string;
  totalUnits: number;
  occupiedUnits: number;
  units: Unit[];
}

const mockProperties: Property[] = [
  {
    id: "prop-1",
    name: "Green Villa",
    address: "14th Cross, 2nd Main, Indiranagar, Bengaluru",
    totalUnits: 4,
    occupiedUnits: 4,
    units: [
      {
        id: "u-101",
        code: "U-101",
        floor: "Ground",
        type: "2 BHK",
        tenantName: "Vijay Kumar",
        rentAmount: 18000,
        incrementSchedule: "5% on 01 Jan 2027",
        status: "OCCUPIED",
      },
      {
        id: "u-102",
        code: "U-102",
        floor: "Ground",
        type: "1 BHK",
        tenantName: "Suresh Nair",
        rentAmount: 12500,
        incrementSchedule: "5% on 01 Mar 2027",
        status: "OCCUPIED",
      },
      {
        id: "u-201",
        code: "U-201",
        floor: "1st Floor",
        type: "2 BHK",
        tenantName: "Rahul Sharma",
        rentAmount: 16000,
        incrementSchedule: "6% on 15 Nov 2026",
        status: "OCCUPIED",
      },
      {
        id: "u-202",
        code: "U-202",
        floor: "1st Floor",
        type: "2 BHK",
        tenantName: "Kavita Reddy",
        rentAmount: 16500,
        incrementSchedule: "5% on 01 Dec 2026",
        status: "OCCUPIED",
      },
    ],
  },
  {
    id: "prop-2",
    name: "Lakeview House",
    address: "88 Outer Ring Road, Bellandur, Bengaluru",
    totalUnits: 2,
    occupiedUnits: 1,
    units: [
      {
        id: "u-01",
        code: "U-01",
        floor: "Ground",
        type: "3 BHK",
        tenantName: "Amit Patel",
        rentAmount: 25000,
        incrementSchedule: "5% on 01 Aug 2027",
        status: "OCCUPIED",
      },
      {
        id: "u-02",
        code: "U-02",
        floor: "1st Floor",
        type: "2 BHK",
        tenantName: null,
        rentAmount: 17000,
        incrementSchedule: null,
        status: "VACANT",
      },
    ],
  },
];

export default function PropertiesPage() {
  const { t } = useTranslation();

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

          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Property
          </Button>
        </div>

        {/* Properties List */}
        <div className="space-y-6">
          {mockProperties.map((prop) => (
            <Card key={prop.id}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-surface-muted flex items-center justify-center text-primary border border-border/40">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {prop.name}
                    </CardTitle>
                    <CardContent className="p-0 text-xs text-text-muted">
                      {prop.address}
                    </CardContent>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={prop.occupiedUnits === prop.totalUnits ? "paid" : "pending"}>
                    {prop.occupiedUnits} / {prop.totalUnits} Units Occupied
                  </Badge>
                  <Button variant="outline" size="sm" className="text-xs">
                    Configure House
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Rent (INR)</TableHead>
                      <TableHead>Scheduled Increment</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prop.units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono font-semibold text-text-primary">
                          {unit.code}
                        </TableCell>
                        <TableCell className="text-text-muted text-xs">
                          {unit.floor}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {unit.type}
                        </TableCell>
                        <TableCell>
                          {unit.tenantName ? (
                            <span className="font-medium text-text-primary flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-text-muted" />
                              {unit.tenantName}
                            </span>
                          ) : (
                            <span className="text-text-muted italic text-xs">
                              None (Vacant)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {formatINR(unit.rentAmount)}
                        </TableCell>
                        <TableCell className="text-xs text-text-muted">
                          {unit.incrementSchedule ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="h-3 w-3 text-status-pending-fg" />
                              {unit.incrementSchedule}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              unit.status === "OCCUPIED"
                                ? "paid"
                                : unit.status === "VACANT"
                                ? "neutral"
                                : "pending"
                            }
                          >
                            {unit.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </OwnerShell>
  );
}
