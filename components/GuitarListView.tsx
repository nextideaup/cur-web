"use client";

import { useState } from "react";
import { GuitarItem, CONDITION_COLORS } from "@/lib/types";
import { useHideValues } from "@/lib/HideValuesContext";
import SelectionCheckbox from "@/components/SelectionCheckbox";
import SortableHeader from "@/components/forms/SortableHeader";

// Small primary-photo thumbnail for the first column. Own error state so a
// missing/broken image falls back to a placeholder without affecting the row.
function RowThumb({ item }: { item: GuitarItem }) {
  const [err, setErr] = useState(false);
  const img = item.images?.find((i) => i.is_primary) ?? item.images?.[0];
  return (
    <div className="w-10 h-10 rounded-md overflow-hidden bg-surface-2 flex items-center justify-center shrink-0">
      {img && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.path} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <svg className="w-5 h-5 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
        </svg>
      )}
    </div>
  );
}

const fmtRaw = (price: number | null | undefined) => {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
};

// Column key matches the SortField union in app/guitars/[category]/page.tsx.
// Header click toggles sort via the parent-supplied onSortToggle.
const COLUMNS: { label: string; field?: string; align?: "left" | "right" }[] = [
  { label: "Year", field: "year" },
  { label: "Brand", field: "brand" },
  { label: "Model", field: "model" },
  { label: "Color / Finish", field: "color_finish" },
  { label: "Condition", field: "condition" },
  { label: "Short Description", field: "short_description" },
  { label: "Buy Cost", field: "purchase_price" },
  { label: "AI Est.", field: "latest_ai_price" },
  { label: "My Value", field: "latest_user_price" },
  { label: "Insured", field: "insure" },
  { label: "Insured Value", field: "insurance_value" },
  // "Open to Sell" is a placeholder for the future Sell flow — not sortable.
  { label: "Open to Sell" },
];

interface GuitarListViewProps {
  items: GuitarItem[];
  onItemClick: (item: GuitarItem) => void;
  onDelete: (id: string) => void;
  // Bulk-select props (optional — when omitted, the checkbox column is
  // hidden so callers that don't need selection keep working unchanged).
  selectedIds?: Set<string>;
  onSelectChange?: (id: string, selected: boolean) => void;
  onSelectAllToggle?: () => void;
  // Sort props (optional — when omitted headers render as static labels).
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortToggle?: (field: string) => void;
}

export default function GuitarListView({
  items,
  onItemClick,
  selectedIds,
  onSelectChange,
  onSelectAllToggle,
  sortBy,
  sortDir,
  onSortToggle,
}: GuitarListViewProps) {
  const { hideValues } = useHideValues();
  const fmt = (price: number | null | undefined) => hideValues ? "$•••" : fmtRaw(price);

  const selectionEnabled = !!selectedIds && !!onSelectChange && !!onSelectAllToggle;
  const selectedCount = selectedIds?.size ?? 0;
  const headerState: boolean | "indeterminate" =
    selectedCount === 0 ? false : selectedCount === items.length ? true : "indeterminate";

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-surface-2 border-b border-border">
            {selectionEnabled && (
              <th className="px-4 py-3 w-10">
                <SelectionCheckbox state={headerState} onChange={onSelectAllToggle!} header />
              </th>
            )}
            <th className="px-4 py-3 w-14 text-left" />
            {COLUMNS.map((col) => (
              <SortableHeader
                key={col.label}
                label={col.label}
                field={onSortToggle ? col.field : undefined}
                currentSort={sortBy ?? ""}
                currentDir={sortDir ?? "desc"}
                onToggle={onSortToggle ?? (() => {})}
                align={col.align}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const isSelected = selectedIds?.has(item.id) ?? false;
            return (
              <tr
                key={item.id}
                onClick={() => onItemClick(item)}
                className={`group cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors ${
                  isSelected ? "bg-accent/5" : idx % 2 === 0 ? "bg-surface" : "bg-surface/60"
                }`}
              >
                {selectionEnabled && (
                  <td className="px-4 py-3 w-10">
                    <SelectionCheckbox
                      state={isSelected}
                      onChange={() => onSelectChange!(item.id, !isSelected)}
                    />
                  </td>
                )}
                <td className="px-4 py-3"><RowThumb item={item} /></td>
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">{item.year ?? "—"}</td>
                <td className="px-4 py-3 text-text font-medium whitespace-nowrap">{item.brand}</td>
                <td className="px-4 py-3 text-text whitespace-nowrap">{item.model}</td>
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">{item.color_finish || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${CONDITION_COLORS[item.condition]}`}
                  >
                    {item.condition}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted max-w-[180px] truncate">{item.short_description || "—"}</td>
                <td className="px-4 py-3 text-text font-mono whitespace-nowrap">{fmt(item.purchase_price)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {item.latest_ai_price != null ? (
                    <span className="text-accent font-mono font-medium">{fmt(item.latest_ai_price)}</span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {item.latest_user_price != null ? (
                    <span className="text-text font-mono font-medium">{fmt(item.latest_user_price)}</span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </td>
                {/* Insured */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {item.insure ? (
                    <span className="text-accent text-xs font-medium">Yes</span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </td>
                {/* Insured Value */}
                <td className="px-4 py-3 whitespace-nowrap font-mono">
                  {item.insurance_value != null ? (
                    <span className="text-text font-medium">{fmt(item.insurance_value)}</span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </td>
                {/* Open to Sell — placeholder, future Sell flow */}
                <td className="px-4 py-3 text-text-dim">—</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
