"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/forms/ModalShell";

interface ChannelState {
  channel: "reverb" | "ebay";
  connected: boolean;
  oauth: boolean;
  label: string | null;
  meta: Record<string, string | boolean>;
  updated_at: string | null;
}

const inputCls =
  "w-full bg-surface-2 border border-border text-text rounded-xl px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none";
const btnCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50";

// Messages for the ?ebay=… status the OAuth callback redirects back with.
const EBAY_STATUS: Record<string, string> = {
  connected: "eBay connected.",
  denied: "eBay authorization was cancelled.",
  state_error: "eBay connect failed (session mismatch). Please try again.",
  exchange_failed: "eBay token exchange failed. Please try again.",
  not_configured: "eBay OAuth isn’t configured on the server.",
};

export default function MarketplaceModal({ onClose }: { onClose: () => void }) {
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [encOk, setEncOk] = useState(true);
  const [ebayOAuthAvailable, setEbayOAuthAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reverb form
  const [reverbToken, setReverbToken] = useState("");
  const [reverbSandbox, setReverbSandbox] = useState(false);

  // eBay account config (saved via meta-only PATCH after connecting)
  const [ebayMeta, setEbayMeta] = useState({
    marketplaceId: "EBAY_US",
    merchantLocationKey: "",
    fulfillmentPolicyId: "",
    paymentPolicyId: "",
    returnPolicyId: "",
    categoryId: "",
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/marketplace/credentials");
      if (res.ok) {
        const data = (await res.json()) as {
          encryption_available: boolean;
          ebay_oauth_available: boolean;
          channels: ChannelState[];
        };
        setEncOk(data.encryption_available);
        setEbayOAuthAvailable(data.ebay_oauth_available);
        setChannels(data.channels ?? []);
        const eb = data.channels?.find((c) => c.channel === "ebay");
        if (eb?.meta) {
          setEbayMeta((m) => ({
            marketplaceId: (eb.meta.marketplaceId as string) || m.marketplaceId,
            merchantLocationKey: (eb.meta.merchantLocationKey as string) || "",
            fulfillmentPolicyId: (eb.meta.fulfillmentPolicyId as string) || "",
            paymentPolicyId: (eb.meta.paymentPolicyId as string) || "",
            returnPolicyId: (eb.meta.returnPolicyId as string) || "",
            categoryId: (eb.meta.categoryId as string) || "",
          }));
        }
        const rv = data.channels?.find((c) => c.channel === "reverb");
        if (rv?.meta) setReverbSandbox(!!rv.meta.sandbox);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Surface the OAuth callback result (?ebay=connected|denied|…) then strip it.
    const p = new URLSearchParams(window.location.search).get("ebay");
    if (p) {
      setMsg(EBAY_STATUS[p] ?? `eBay: ${p}`);
      const u = new URL(window.location.href);
      u.searchParams.delete("ebay");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  const status = (ch: string) => channels.find((c) => c.channel === ch);

  async function saveReverb() {
    if (!reverbToken.trim()) {
      setMsg("Enter your Reverb token first.");
      return;
    }
    setBusy("reverb");
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "reverb", token: reverbToken, meta: { sandbox: reverbSandbox } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Reverb connected.");
      setReverbToken("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveEbayMeta() {
    setBusy("ebay");
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "ebay", meta: ebayMeta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("eBay listing settings saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(channel: "reverb" | "ebay") {
    if (!confirm(`Disconnect ${channel === "reverb" ? "Reverb" : "eBay"}? Stored credentials are deleted.`)) return;
    setBusy(channel);
    try {
      await fetch(`/api/marketplace/credentials?channel=${channel}`, { method: "DELETE" });
      setMsg(`${channel === "reverb" ? "Reverb" : "eBay"} disconnected.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const ebayConnected = status("ebay")?.connected ?? false;

  return (
    <ModalShell title="Marketplace connections" subtitle="Connect Reverb / eBay to draft listings from your collection" onClose={onClose}>
      <div className="px-6 py-6 space-y-6">
        {!encOk && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
            Credential encryption isn’t configured on the server, so tokens can’t be stored. Set MARKETPLACE_ENC_KEY (or NEXTAUTH_SECRET).
          </p>
        )}
        {msg && <p className="text-xs text-accent">{msg}</p>}
        {loading && <p className="text-xs text-text-dim">Loading…</p>}

        {/* Reverb — self-serve personal access token */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Reverb {status("reverb")?.connected && <span className="text-emerald-400 text-xs font-normal">· connected</span>}</h3>
            {status("reverb")?.connected && (
              <button onClick={() => disconnect("reverb")} disabled={busy === "reverb"} className="text-xs text-text-muted hover:text-red-400">Disconnect</button>
            )}
          </div>
          <p className="text-xs text-text-dim">Personal access token from Reverb → Settings → API. Needs the <code>write_listings</code> scope.</p>
          <input type="password" value={reverbToken} onChange={(e) => setReverbToken(e.target.value)} placeholder={status("reverb")?.connected ? "•••••••• (enter a new token to replace)" : "Reverb personal access token"} className={inputCls} />
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" checked={reverbSandbox} onChange={(e) => setReverbSandbox(e.target.checked)} className="accent-accent" />
            Use Reverb sandbox
          </label>
          <button onClick={saveReverb} disabled={busy === "reverb" || !encOk} className={btnCls}>
            {busy === "reverb" ? "Saving…" : "Save Reverb token"}
          </button>
        </section>

        {/* eBay — OAuth "Connect eBay" (sellers authorize with their own login) */}
        <section className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">
              eBay {ebayConnected && <span className="text-emerald-400 text-xs font-normal">· connected{status("ebay")?.meta?.sandbox ? " (sandbox)" : ""}</span>}
            </h3>
            {ebayConnected && (
              <button onClick={() => disconnect("ebay")} disabled={busy === "ebay"} className="text-xs text-text-muted hover:text-red-400">Disconnect</button>
            )}
          </div>

          {!ebayOAuthAvailable ? (
            <p className="text-xs text-text-dim bg-surface-2 rounded-lg px-3 py-2">
              eBay isn’t configured on the server yet. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME to enable “Connect eBay”.
            </p>
          ) : !ebayConnected ? (
            <>
              <p className="text-xs text-text-dim">Sign in with your normal eBay account to authorize Vault1 to draft listings on your behalf.</p>
              <a href="/api/marketplace/ebay/connect" className={`${btnCls} inline-flex items-center gap-1.5 no-underline`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Connect eBay
              </a>
            </>
          ) : (
            <>
              <p className="text-xs text-text-dim">Listing settings — required for eBay to draft an offer (from the eBay Account &amp; Inventory-Location APIs):</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={ebayMeta.marketplaceId} onChange={(e) => setEbayMeta({ ...ebayMeta, marketplaceId: e.target.value })} placeholder="marketplaceId (EBAY_US)" className={inputCls} />
                <input value={ebayMeta.categoryId} onChange={(e) => setEbayMeta({ ...ebayMeta, categoryId: e.target.value })} placeholder="categoryId (leaf)" className={inputCls} />
                <input value={ebayMeta.merchantLocationKey} onChange={(e) => setEbayMeta({ ...ebayMeta, merchantLocationKey: e.target.value })} placeholder="merchantLocationKey" className={inputCls} />
                <input value={ebayMeta.fulfillmentPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, fulfillmentPolicyId: e.target.value })} placeholder="fulfillmentPolicyId" className={inputCls} />
                <input value={ebayMeta.paymentPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, paymentPolicyId: e.target.value })} placeholder="paymentPolicyId" className={inputCls} />
                <input value={ebayMeta.returnPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, returnPolicyId: e.target.value })} placeholder="returnPolicyId" className={inputCls} />
              </div>
              <button onClick={saveEbayMeta} disabled={busy === "ebay"} className={btnCls}>
                {busy === "ebay" ? "Saving…" : "Save eBay settings"}
              </button>
            </>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
