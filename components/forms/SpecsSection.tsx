"use client";

import { useState } from "react";
import type { SpecEntry } from "@/lib/types";
import { useSpecsList } from "@/lib/hooks/useSpecsList";
import SpecsEditor from "@/components/forms/SpecsEditor";

interface SpecsSectionProps {
  // URL segment for the module, e.g. "guitars" | "watches" | "automobiles" | "iod".
  module: string;
  itemId: string;
  specs?: SpecEntry[] | null;
  specsUpdatedAt?: string | null;
  template?: readonly string[];
  // Bubbles the new specs (and timestamp) up so the parent modal/list can keep
  // its in-memory item in sync.
  onUpdated: (specs: SpecEntry[], specsUpdatedAt: string | null) => void;
}

/**
 * Detail-modal "Specs" section. Read-only display of the item's specs with two
 * actions: "Generate specs with AI" (web_search-backed lookup that preserves
 * manual overrides) and "Edit" (inline manual editing → PATCH). The primary
 * surface for the prompted-AI population the feature calls for.
 */
export default function SpecsSection({
  module,
  itemId,
  specs,
  specsUpdatedAt,
  template,
  onUpdated,
}: SpecsSectionProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editList = useSpecsList(specs);

  const current = specs ?? [];

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/${module}/${itemId}/specs`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Specs generation failed");
      }
      const data = (await res.json()) as { specs: SpecEntry[]; specs_updated_at: string | null };
      onUpdated(data.specs, data.specs_updated_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  function startEdit() {
    editList.reset(specs);
    setError("");
    setMode("edit");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/${module}/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specs: editList.derive() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save specs");
      }
      const item = (await res.json()) as { specs?: SpecEntry[] | null; specs_updated_at?: string | null };
      onUpdated(item.specs ?? [], item.specs_updated_at ?? null);
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-muted">Specs</h3>
        {mode === "view" && (
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              {generating ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              )}
              {generating ? "Researching…" : current.length > 0 ? "Refresh with AI" : "Generate specs with AI"}
            </button>
            <span className="text-border">·</span>
            <button
              onClick={startEdit}
              className="text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {mode === "edit" ? (
        <div className="space-y-3">
          <SpecsEditor specs={editList} templateSuggestions={template} label="Edit specs" />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              {saving ? "Saving…" : "Save specs"}
            </button>
            <button
              onClick={() => setMode("view")}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : current.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-surface-2 rounded-xl p-3">
            {current.map((s, i) => (
              <div key={`${s.label}-${i}`} className="min-w-0">
                <p className="text-xs text-text-dim flex items-center gap-1">
                  {s.label}
                  {s.source === "ai" && (
                    <span title="Generated by AI" className="text-[9px] font-semibold uppercase text-sky-400">AI</span>
                  )}
                </p>
                <p className="text-sm text-text break-words">{s.value}</p>
              </div>
            ))}
          </div>
          {specsUpdatedAt && (
            <p className="text-[11px] text-text-dim mt-1.5">
              Updated {new Date(specsUpdatedAt).toLocaleDateString()}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-text-dim bg-surface-2 rounded-xl p-3">
          No specs captured yet. Generate them with AI or add them manually — they’ll be used when listing this item for sale.
        </p>
      )}
    </div>
  );
}
