"use client";

import { useEffect, useState, useCallback } from "react";
import {
  WatchPursuit,
  WATCH_SOURCES,
  PURSUIT_STATUS_STYLES,
  PursuitStatus,
} from "@/lib/types";
import { useHideValues } from "@/lib/HideValuesContext";
import AddWatchPursuitModal from "@/components/AddWatchPursuitModal";
import EditWatchPursuitModal from "@/components/EditWatchPursuitModal";
import PursuitFindingsList, { PursuitFinding } from "@/components/PursuitFindingsList";
import PursuitCheckinModal, { CheckinPursuit } from "@/components/PursuitCheckinModal";

const formatCurrencyRaw = (value: number | null | undefined) => {
  if (value == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const getSourceLabel = (id: string, otherSource?: string | null) => {
  if (id === "other" && otherSource) return otherSource;
  return WATCH_SOURCES.find((s) => s.id === id)?.label ?? id;
};

const STATUS_LABELS: Record<PursuitStatus, string> = {
  active: "Active",
  found: "Found",
  paused: "Paused",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function needsCheckin(p: WatchPursuit): boolean {
  if (p.status !== "active") return false;
  if (p.checkin_dismissed) return false;
  if (Date.now() - new Date(p.created_at).getTime() < THIRTY_DAYS_MS) return false;
  if (p.checkin_snoozed_until && new Date(p.checkin_snoozed_until) > new Date()) return false;
  return true;
}

export default function WatchPursuitPage() {
  const { hideValues } = useHideValues();
  const formatCurrency = (v: number | null | undefined): string | null => {
    if (v == null) return null;
    if (hideValues) return "$•••";
    return formatCurrencyRaw(v);
  };
  const formatPriceRange = (min: number | null, max: number | null): string | null => {
    if (min == null && max == null) return null;
    if (min != null && max != null) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
    if (min != null) return `From ${formatCurrency(min)}`;
    return `Up to ${formatCurrency(max)}`;
  };
  const [pursuits, setPursuits]       = useState<WatchPursuit[]>([]);
  const [findings, setFindings]       = useState<Record<string, PursuitFinding[]>>({});
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [editPursuit, setEditPursuit] = useState<WatchPursuit | null>(null);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [clearingId, setClearingId]   = useState<string | null>(null);
  const [checkinQueue, setCheckinQueue] = useState<CheckinPursuit[]>([]);

  async function loadFindings() {
    const res = await fetch("/api/watch-pursuits/findings");
    if (res.ok) setFindings(await res.json());
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/watch-pursuits");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: WatchPursuit[] = await res.json();
        setPursuits(data);
        await loadFindings();
        // Show check-in modal for any pursuits that have been running 30+ days
        const queue: CheckinPursuit[] = data
          .filter(needsCheckin)
          .map((p) => ({
            id: p.id,
            type: "watch" as const,
            name: [p.brand, p.model].filter(Boolean).join(" ") || "Unnamed",
            created_at: p.created_at,
          }));
        if (queue.length) setCheckinQueue(queue);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function clearFindings(pursuitId: string) {
    setClearingId(pursuitId);
    try {
      await fetch(`/api/watch-pursuits/findings?id=${pursuitId}`, { method: "DELETE" });
      setFindings((prev) => ({ ...prev, [pursuitId]: [] }));
    } finally {
      setClearingId(null);
    }
  }

  async function searchNow(pursuitId: string) {
    setSearchingId(pursuitId);
    try {
      await fetch("/api/pursuits/run-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pursuit_type: "watch", pursuit_id: pursuitId }),
      });
      await loadFindings();
    } finally {
      setSearchingId(null);
    }
  }

  const handleSaved = useCallback((p: WatchPursuit) => {
    setPursuits((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      if (exists) return prev.map((x) => (x.id === p.id ? p : x));
      return [p, ...prev];
    });
    setShowAdd(false);
    setEditPursuit(null);
  }, []);

  const handleDeleted = useCallback(() => {
    if (editPursuit) {
      setPursuits((prev) => prev.filter((x) => x.id !== editPursuit.id));
      setEditPursuit(null);
    }
  }, [editPursuit]);

  const handleCheckinComplete = useCallback(
    (updates: { id: string; action: "snooze" | "dismiss" | "deactivate" }[]) => {
      setCheckinQueue([]);
      setPursuits((prev) =>
        prev.map((p) => {
          const u = updates.find((x) => x.id === p.id);
          if (!u) return p;
          if (u.action === "snooze")
            return { ...p, checkin_snoozed_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
          if (u.action === "dismiss")
            return { ...p, checkin_dismissed: true };
          if (u.action === "deactivate")
            return { ...p, status: "paused" as const };
          return p;
        })
      );
    },
    []
  );

  const activeCount = pursuits.filter((p) => p.status === "active").length;
  const foundCount = pursuits.filter((p) => p.status === "found").length;
  const pausedCount = pursuits.filter((p) => p.status === "paused").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-label mb-1">
            The Pursuit
          </p>
          <h1 className="font-headline text-4xl text-text">Watches</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-accent text-on-primary px-4 py-2 rounded font-label text-sm uppercase tracking-widest hover:bg-accent/90 transition-colors"
        >
          + Add to Pursuit
        </button>
      </div>

      <div className="border-b border-border mt-4 mb-8" />

      {/* Stats */}
      {!loading && pursuits.length > 0 && (
        <div className="flex items-center gap-3 mb-8">
          <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 text-xs px-3 py-1.5 rounded-full font-medium">
            {activeCount} Active
          </span>
          <span className="bg-accent/10 text-accent border border-accent/30 text-xs px-3 py-1.5 rounded-full font-medium">
            {foundCount} Found
          </span>
          <span className="bg-surface-3 text-text-dim border border-border text-xs px-3 py-1.5 rounded-full font-medium">
            {pausedCount} Paused
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-2 rounded-lg p-6 h-44 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && pursuits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-text font-medium mb-1">No pursuits yet</p>
          <p className="text-text-dim text-sm mb-6">
            Track watches you&apos;re hunting for and where to find them.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-accent text-on-primary px-5 py-2.5 rounded font-label text-sm uppercase tracking-widest hover:bg-accent/90 transition-colors"
          >
            + Add to Pursuit
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && pursuits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pursuits.map((pursuit) => {
            const priceRange = formatPriceRange(pursuit.price_min, pursuit.price_max);
            const title = [pursuit.brand, pursuit.model].filter(Boolean).join(" ") || "Unnamed";

            // Build detail chips
            const details: string[] = [];
            if (pursuit.reference_number) details.push(pursuit.reference_number);
            if (pursuit.case_diameter) details.push(pursuit.case_diameter);
            if (pursuit.dial_color) details.push(pursuit.dial_color);
            if (pursuit.materials) details.push(pursuit.materials);

            return (
              <div
                key={pursuit.id}
                onClick={() => setEditPursuit(pursuit)}
                className="bg-surface-2 rounded-lg p-6 flex flex-col gap-3 group hover:bg-surface-3 transition-colors cursor-pointer border border-border hover:border-accent/20"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-headline text-lg text-text leading-tight truncate">
                      {title}
                    </p>
                    {pursuit.reference_number && (
                      <p className="text-xs text-text-dim mt-0.5 font-mono">
                        Ref. {pursuit.reference_number}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded-full ${
                        PURSUIT_STATUS_STYLES[pursuit.status]
                      }`}
                    >
                      {STATUS_LABELS[pursuit.status]}
                    </span>
                    <div className="w-7 h-7 rounded flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-2 transition-colors opacity-0 group-hover:opacity-100">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Details row */}
                {(details.length > 0 || priceRange) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {details
                      .filter((d) => d !== pursuit.reference_number)
                      .map((detail, i) => (
                        <span key={i} className="text-xs text-text-dim">
                          {detail}
                          {i < details.filter((d) => d !== pursuit.reference_number).length - 1 && (
                            <span className="ml-2 text-border">·</span>
                          )}
                        </span>
                      ))}
                    {priceRange && (
                      <>
                        {details.filter((d) => d !== pursuit.reference_number).length > 0 && (
                          <span className="text-border text-xs">·</span>
                        )}
                        <span className="text-xs text-text font-medium">{priceRange}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Sources */}
                {pursuit.sources && pursuit.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pursuit.sources.map((sourceId) => {
                      const sourceObj = WATCH_SOURCES.find((s) => s.id === sourceId);
                      const needsLoc = sourceObj?.needsLocation;
                      const locationSuffix =
                        needsLoc && pursuit.facebook_location
                          ? ` (${pursuit.facebook_location})`
                          : "";
                      const label =
                        sourceId === "other" && pursuit.other_source
                          ? pursuit.other_source
                          : getSourceLabel(sourceId, pursuit.other_source);
                      return (
                        <span
                          key={sourceId}
                          className="bg-surface-3 text-text-dim text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border"
                        >
                          {label}{locationSuffix}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Notes */}
                {pursuit.notes && (
                  <p className="text-xs text-text-dim italic line-clamp-2">
                    {pursuit.notes}
                  </p>
                )}

                {/* Findings */}
                <PursuitFindingsList
                  findings={findings[pursuit.id] ?? []}
                  onSearch={() => searchNow(pursuit.id)}
                  searching={searchingId === pursuit.id}
                  onClear={() => clearFindings(pursuit.id)}
                  clearing={clearingId === pursuit.id}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddWatchPursuitModal
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}

      {editPursuit && (
        <EditWatchPursuitModal
          pursuit={editPursuit}
          onClose={() => setEditPursuit(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {checkinQueue.length > 0 && (
        <PursuitCheckinModal
          pursuits={checkinQueue}
          onComplete={handleCheckinComplete}
        />
      )}
    </div>
  );
}
