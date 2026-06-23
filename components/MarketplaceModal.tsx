"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/forms/ModalShell";

interface ChannelState {
  channel: "reverb" | "ebay";
  connected: boolean;
  label: string | null;
  meta: Record<string, string | boolean>;
  updated_at: string | null;
}

const inputCls =
  "w-full bg-surface-2 border border-border text-text rounded-xl px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none";

export default function MarketplaceModal({ onClose }: { onClose: () => void }) {
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [encOk, setEncOk] = useState(true);
  const [loading, setLoading] = useState(true);

  // Reverb form
  const [reverbToken, setReverbToken] = useState("");
  const [reverbSandbox, setReverbSandbox] = useState(false);

  // eBay form
  const [ebayToken, setEbayToken] = useState("");
  const [ebaySandbox, setEbaySandbox] = useState(false);
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
        const data = (await res.json()) as { encryption_available: boolean; channels: ChannelState[] };
        setEncOk(data.encryption_available);
        setChannels(data.channels ?? []);
        const eb = data.channels?.find((c) => c.channel === "ebay");
        if (eb?.meta) {
          setEbaySandbox(!!eb.meta.sandbox);
          setEbayMeta((m) => ({
            ...m,
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
  }, []);

  const status = (ch: string) => channels.find((c) => c.channel === ch);

  async function save(channel: "reverb" | "ebay", token: string, meta: Record<string, unknown>) {
    if (!token.trim()) {
      setMsg(`Enter your ${channel === "reverb" ? "Reverb" : "eBay"} token first.`);
      return;
    }
    setBusy(channel);
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, token, meta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(`${channel === "reverb" ? "Reverb" : "eBay"} connected.`);
      if (channel === "reverb") setReverbToken("");
      else setEbayToken("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(channel: "reverb" | "ebay") {
    if (!confirm(`Disconnect ${channel === "reverb" ? "Reverb" : "eBay"}? Stored token is deleted.`)) return;
    setBusy(channel);
    try {
      await fetch(`/api/marketplace/credentials?channel=${channel}`, { method: "DELETE" });
      setMsg(`${channel === "reverb" ? "Reverb" : "eBay"} disconnected.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

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

        {/* Reverb */}
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
          <button onClick={() => save("reverb", reverbToken, { sandbox: reverbSandbox })} disabled={busy === "reverb" || !encOk} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50">
            {busy === "reverb" ? "Saving…" : "Save Reverb token"}
          </button>
        </section>

        {/* eBay */}
        <section className="space-y-2 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">eBay {status("ebay")?.connected && <span className="text-emerald-400 text-xs font-normal">· connected</span>}</h3>
            {status("ebay")?.connected && (
              <button onClick={() => disconnect("ebay")} disabled={busy === "ebay"} className="text-xs text-text-muted hover:text-red-400">Disconnect</button>
            )}
          </div>
          <p className="text-xs text-text-dim">User OAuth access token (sell.inventory scope). Draft offers also need account identifiers below — from the eBay Account & Inventory-Location APIs.</p>
          <input type="password" value={ebayToken} onChange={(e) => setEbayToken(e.target.value)} placeholder={status("ebay")?.connected ? "•••••••• (enter a new token to replace)" : "eBay user access token"} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={ebayMeta.marketplaceId} onChange={(e) => setEbayMeta({ ...ebayMeta, marketplaceId: e.target.value })} placeholder="marketplaceId (EBAY_US)" className={inputCls} />
            <input value={ebayMeta.categoryId} onChange={(e) => setEbayMeta({ ...ebayMeta, categoryId: e.target.value })} placeholder="categoryId (leaf)" className={inputCls} />
            <input value={ebayMeta.merchantLocationKey} onChange={(e) => setEbayMeta({ ...ebayMeta, merchantLocationKey: e.target.value })} placeholder="merchantLocationKey" className={inputCls} />
            <input value={ebayMeta.fulfillmentPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, fulfillmentPolicyId: e.target.value })} placeholder="fulfillmentPolicyId" className={inputCls} />
            <input value={ebayMeta.paymentPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, paymentPolicyId: e.target.value })} placeholder="paymentPolicyId" className={inputCls} />
            <input value={ebayMeta.returnPolicyId} onChange={(e) => setEbayMeta({ ...ebayMeta, returnPolicyId: e.target.value })} placeholder="returnPolicyId" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" checked={ebaySandbox} onChange={(e) => setEbaySandbox(e.target.checked)} className="accent-accent" />
            Use eBay sandbox
          </label>
          <button onClick={() => save("ebay", ebayToken, { ...ebayMeta, sandbox: ebaySandbox })} disabled={busy === "ebay" || !encOk} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50">
            {busy === "ebay" ? "Saving…" : "Save eBay credentials"}
          </button>
        </section>
      </div>
    </ModalShell>
  );
}
