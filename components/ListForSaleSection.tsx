"use client";

import { useEffect, useState, useCallback } from "react";

interface MarketplaceListing {
  id: string;
  channel: "reverb" | "ebay";
  external_id: string | null;
  external_url: string | null;
  state: "draft" | "published" | "ended" | "error";
  error: string | null;
  created_at: string;
}

interface ChannelStatus {
  channel: "reverb" | "ebay";
  connected: boolean;
}

const CHANNEL_LABEL: Record<string, string> = { reverb: "Reverb", ebay: "eBay" };

/**
 * Detail-modal "Sell" section. Shows which marketplaces are connected, lets the
 * user create a DRAFT listing on each, and lists what's already been drafted
 * (with links + error states). Listings are created unpublished — the user
 * reviews and publishes on the marketplace.
 */
export default function ListForSaleSection({ module, itemId }: { module: string; itemId: string }) {
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadListings = useCallback(async () => {
    try {
      const res = await fetch(`/api/${module}/${itemId}/list`);
      if (res.ok) setListings(await res.json());
    } catch { /* non-critical */ }
  }, [module, itemId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/marketplace/credentials");
        if (res.ok) {
          const data = (await res.json()) as { channels: ChannelStatus[] };
          setChannels(data.channels ?? []);
        }
      } catch { /* non-critical */ }
    })();
    loadListings();
  }, [loadListings]);

  async function listOn(channel: "reverb" | "ebay") {
    setBusy(channel);
    setError("");
    try {
      const res = await fetch(`/api/${module}/${itemId}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Listing failed");
      await loadListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const isConnected = (ch: string) => channels.find((c) => c.channel === ch)?.connected ?? false;

  return (
    <div>
      <h3 className="text-sm font-medium text-text-muted mb-3">Sell</h3>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-3">
        {(["reverb", "ebay"] as const).map((ch) => {
          const connected = isConnected(ch);
          return (
            <button
              key={ch}
              onClick={() => connected && listOn(ch)}
              disabled={!connected || busy === ch}
              title={connected ? `Create an unpublished draft on ${CHANNEL_LABEL[ch]}` : `Connect ${CHANNEL_LABEL[ch]} in Marketplace settings first`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                connected
                  ? "bg-surface-2 text-text border-border hover:border-accent/40 hover:text-accent disabled:opacity-50 disabled:cursor-wait"
                  : "bg-surface-2/50 text-text-dim border-border opacity-60 cursor-not-allowed"
              }`}
            >
              {busy === ch ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
              {connected ? `Draft on ${CHANNEL_LABEL[ch]}` : `${CHANNEL_LABEL[ch]} not connected`}
            </button>
          );
        })}
      </div>

      {listings.length > 0 ? (
        <div className="space-y-1.5">
          {listings.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-xs bg-surface-2 rounded-lg px-3 py-2">
              <span className="font-medium text-text">{CHANNEL_LABEL[l.channel]}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  l.state === "error"
                    ? "bg-red-900/30 text-red-300"
                    : l.state === "published"
                    ? "bg-emerald-900/30 text-emerald-300"
                    : "bg-sky-900/30 text-sky-300"
                }`}
              >
                {l.state}
              </span>
              {l.external_url ? (
                <a href={l.external_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                  View on {CHANNEL_LABEL[l.channel]} →
                </a>
              ) : l.error ? (
                <span className="text-red-400 truncate" title={l.error}>{l.error}</span>
              ) : (
                <span className="text-text-dim">draft created</span>
              )}
              <span className="text-text-dim ml-auto shrink-0">{new Date(l.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-dim">
          No listings yet. Drafts are created unpublished — you review and publish on the marketplace.
        </p>
      )}
    </div>
  );
}
