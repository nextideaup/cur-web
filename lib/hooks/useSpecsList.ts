"use client";

import { useMemo, useRef, useState } from "react";
import type { SpecEntry } from "@/lib/types";

// Editable row model: a SpecEntry plus a stable key for React lists (so adding
// / removing rows doesn't reuse the wrong input state).
interface SpecRow extends SpecEntry {
  key: string;
}

export interface SpecsListApi {
  rows: SpecRow[];
  addRow: (label?: string) => void;
  updateLabel: (key: string, label: string) => void;
  updateValue: (key: string, value: string) => void;
  removeRow: (key: string) => void;
  reset: (specs?: SpecEntry[] | null) => void;
  // Cleaned payload for submit: drops rows missing a label or value.
  derive: () => SpecEntry[];
  // True when the current rows differ from the baseline (initial value, or the
  // last reset()). Lets the Edit modals omit `specs` from the PATCH when the
  // user didn't touch them, so specs_updated_at isn't re-stamped on an
  // unrelated field edit.
  isDirty: () => boolean;
}

let counter = 0;
const nextKey = () => `spec-${counter++}`;

function toRows(specs?: SpecEntry[] | null): SpecRow[] {
  return (specs ?? [])
    .filter((s) => s && (s.label || s.value))
    .map((s) => ({
      label: s.label ?? "",
      value: s.value ?? "",
      source: s.source === "ai" ? "ai" : "manual",
      key: nextKey(),
    }));
}

// Cleaned form used by both derive() and the dirty baseline: trim, drop rows
// missing a label or value.
function clean(rows: SpecRow[]): SpecEntry[] {
  return rows
    .map((r) => ({ label: r.label.trim(), value: r.value.trim(), source: r.source }))
    .filter((r) => r.label && r.value);
}

// Local editable list of spec rows for the Add/Edit modals and the Detail
// edit mode. Any edit to a row's label or value flips its source to "manual" —
// editing an AI-sourced value is exactly the "manual override" the spec calls
// for, and it makes that row survive future AI refreshes.
export function useSpecsList(initial?: SpecEntry[] | null): SpecsListApi {
  const [rows, setRows] = useState<SpecRow[]>(() => toRows(initial));
  // Keep a ref so derive()/isDirty() inside an async submit always see the
  // latest rows.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Serialized cleaned baseline to diff against for isDirty(). Seeded from the
  // initial specs and refreshed on reset().
  const baselineRef = useRef<string>(JSON.stringify(clean(toRows(initial))));

  return useMemo<SpecsListApi>(() => {
    function update(next: SpecRow[]) {
      rowsRef.current = next;
      setRows(next);
    }
    return {
      rows,
      addRow(label = "") {
        update([...rowsRef.current, { label, value: "", source: "manual", key: nextKey() }]);
      },
      updateLabel(key, label) {
        update(rowsRef.current.map((r) => (r.key === key ? { ...r, label, source: "manual" } : r)));
      },
      updateValue(key, value) {
        update(rowsRef.current.map((r) => (r.key === key ? { ...r, value, source: "manual" } : r)));
      },
      removeRow(key) {
        update(rowsRef.current.filter((r) => r.key !== key));
      },
      reset(specs) {
        const next = toRows(specs);
        baselineRef.current = JSON.stringify(clean(next));
        update(next);
      },
      derive() {
        return clean(rowsRef.current);
      },
      isDirty() {
        return JSON.stringify(clean(rowsRef.current)) !== baselineRef.current;
      },
    };
  }, [rows]);
}
