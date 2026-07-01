"use client";

import { GuitarItem, CONDITION_COLORS } from "@/lib/types";
import { useHideValues } from "@/lib/HideValuesContext";
import SelectionCheckbox from "@/components/SelectionCheckbox";
import SortableHeader from "@/components/forms/SortableHeader";
import RowThumb from "@/components/RowThumb";

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
                <td className="px-4 py-3"><RowThumb images={item.images} /></td>
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
