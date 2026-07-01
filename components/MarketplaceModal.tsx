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

interface EbayOption { id: string; name: string; }
interface EbayAccountOptions {
  locations: EbayOption[];
  fulfillmentPolicies: EbayOption[];
  paymentPolicies: EbayOption[];
  returnPolicies: EbayOption[];
  needs_reauth?: boolean;
  setup_links?: { policies: string; locations: string };
}

const inputCls =
  "w-full bg-surface-2 border border-border text-text rounded-xl px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none";
const btnCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50";

// A labelled dropdown for an eBay account setting. When the account has no
// options of this type, shows guidance + a deep link to set it up on eBay.
function OptionSelect({
  label, value, options, onChange, emptyHint, setupLink,
}: {
  label: string;
  value: string;
  options: EbayOption[];
  onChange: (v: string) => void;
  emptyHint: string;
  setupLink?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      {options.length === 0 ? (
        <p className="text-xs text-text-dim">
          {emptyHint}{" "}
          {setupLink && (
            <a href={setupLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Set up on eBay ↗</a>
          )}
        </p>
      ) : (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

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

  const [ebayOptions, setEbayOptions] = useState<EbayAccountOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Inline "create inventory location" form (eBay has no self-serve UI for it).
  const [locForm, setLocForm] = useState({
    name: "Default",
    addressLine1: "",
    city: "",
    stateOrProvince: "",
    postalCode: "",
    country: "US",
  });
  const [creatingLoc, setCreatingLoc] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Fetch the seller's eBay locations + policies to populate the dropdowns, and
  // auto-select any setting that has exactly one option and isn't set yet.
  async function loadEbayOptions(marketplaceId: string, announce = false) {
    setOptionsLoading(true);
    try {
      const res = await fetch(`/api/marketplace/ebay/account-options?marketplaceId=${encodeURIComponent(marketplaceId || "EBAY_US")}`);
      if (!res.ok) {
        if (announce) setMsg("Couldn’t reach eBay to re-detect. Try again in a moment.");
        return;
      }
      const data = (await res.json()) as EbayAccountOptions;
      setEbayOptions(data);
      const only = (opts: EbayOption[]) => (opts?.length === 1 ? opts[0].id : "");
      setEbayMeta((m) => ({
        ...m,
        merchantLocationKey: m.merchantLocationKey || only(data.locations),
        fulfillmentPolicyId: m.fulfillmentPolicyId || only(data.fulfillmentPolicies),
        paymentPolicyId: m.paymentPolicyId || only(data.paymentPolicies),
        returnPolicyId: m.returnPolicyId || only(data.returnPolicies),
      }));
      if (announce) {
        if (data.needs_reauth) {
          setMsg("Reconnect eBay to read your policies — the connection is missing the account-read permission.");
        } else {
          setMsg(
            `Re-detected from eBay: ${data.fulfillmentPolicies.length} shipping, ${data.paymentPolicies.length} payment, ${data.returnPolicies.length} return; ${data.locations.length} location(s).`,
          );
        }
      }
    } finally {
      setOptionsLoading(false);
    }
  }

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
        if (eb?.connected) loadEbayOptions((eb.meta.marketplaceId as string) || "EBAY_US");
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

  async function createLocation() {
    if (!locForm.postalCode.trim() || !locForm.country.trim()) {
      setMsg("Enter at least a postal code and country to create a location.");
      return;
    }
    setCreatingLoc(true);
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/ebay/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create location");
      setMsg("Inventory location created.");
      // Re-detect so the new location appears + auto-selects.
      await loadEbayOptions(ebayMeta.marketplaceId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create location");
    } finally {
      setCreatingLoc(false);
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
              {ebayOptions?.needs_reauth && (
                <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
                  Reconnect eBay to grant permission to read your business policies.{" "}
                  <a href="/api/marketplace/ebay/connect" className="text-accent hover:underline">Reconnect ↗</a>
                </div>
              )}
              <p className="text-xs text-text-dim">
                Listing settings for eBay drafts. Category is detected automatically per item — the field below is an optional override.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Marketplace</label>
                  <input
                    value={ebayMeta.marketplaceId}
                    onChange={(e) => setEbayMeta({ ...ebayMeta, marketplaceId: e.target.value })}
                    onBlur={() => loadEbayOptions(ebayMeta.marketplaceId)}
                    placeholder="EBAY_US"
                    className={inputCls}
                  />
                </div>
                <OptionSelect label="Shipping (fulfillment) policy" value={ebayMeta.fulfillmentPolicyId} options={ebayOptions?.fulfillmentPolicies ?? []} onChange={(v) => setEbayMeta({ ...ebayMeta, fulfillmentPolicyId: v })} emptyHint="No shipping policy found." setupLink={ebayOptions?.setup_links?.policies} />
                <OptionSelect label="Payment policy" value={ebayMeta.paymentPolicyId} options={ebayOptions?.paymentPolicies ?? []} onChange={(v) => setEbayMeta({ ...ebayMeta, paymentPolicyId: v })} emptyHint="No payment policy found." setupLink={ebayOptions?.setup_links?.policies} />
                <OptionSelect label="Return policy" value={ebayMeta.returnPolicyId} options={ebayOptions?.returnPolicies ?? []} onChange={(v) => setEbayMeta({ ...ebayMeta, returnPolicyId: v })} emptyHint="No return policy found." setupLink={ebayOptions?.setup_links?.policies} />
                <div>
                  <label className="block text-xs text-text-muted mb-1">Category override (optional)</label>
                  <input value={ebayMeta.categoryId} onChange={(e) => setEbayMeta({ ...ebayMeta, categoryId: e.target.value })} placeholder="auto-detected per item" className={inputCls} />
                </div>
              </div>

              {/* Inventory location — dropdown when the account has one, else an
                  in-app create form (eBay has no self-serve page for this). */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Inventory location</label>
                {(ebayOptions?.locations?.length ?? 0) > 0 ? (
                  <select value={ebayMeta.merchantLocationKey} onChange={(e) => setEbayMeta({ ...ebayMeta, merchantLocationKey: e.target.value })} className={inputCls}>
                    <option value="">Select…</option>
                    {ebayOptions!.locations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2 bg-surface-2 rounded-xl p-3">
                    <p className="text-xs text-text-dim">
                      No inventory location on your account — eBay needs one to draft an offer, and there’s no eBay page to add it (it’s API-only). Create one here:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="Name (e.g. Default)" className={inputCls} />
                      <input value={locForm.country} onChange={(e) => setLocForm({ ...locForm, country: e.target.value })} placeholder="Country (US)" className={inputCls} />
                      <input value={locForm.postalCode} onChange={(e) => setLocForm({ ...locForm, postalCode: e.target.value })} placeholder="Postal code *" className={inputCls} />
                      <input value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} placeholder="City" className={inputCls} />
                      <input value={locForm.stateOrProvince} onChange={(e) => setLocForm({ ...locForm, stateOrProvince: e.target.value })} placeholder="State/Province" className={inputCls} />
                      <input value={locForm.addressLine1} onChange={(e) => setLocForm({ ...locForm, addressLine1: e.target.value })} placeholder="Address line 1 (optional)" className={inputCls} />
                    </div>
                    <button onClick={createLocation} disabled={creatingLoc} className={btnCls}>
                      {creatingLoc ? "Creating…" : "Create location"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={saveEbayMeta} disabled={busy === "ebay"} className={btnCls}>
                  {busy === "ebay" ? "Saving…" : "Save eBay settings"}
                </button>
                <button
                  onClick={() => loadEbayOptions(ebayMeta.marketplaceId, true)}
                  disabled={optionsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text border border-border hover:border-accent/40 hover:text-accent disabled:opacity-50 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 ${optionsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.985 19.644v-4.992h4.992m-4.005-7.51A8.25 8.25 0 0118.79 6.13M19.02 16.372A8.25 8.25 0 015.21 17.87" />
                  </svg>
                  {optionsLoading ? "Re-detecting…" : "Re-detect policies & locations"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
