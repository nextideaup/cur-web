"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import ImportExportModal from "@/components/ImportExportModal";
import MarketplaceModal from "@/components/MarketplaceModal";
import ManageCollectionsModal from "@/components/ManageCollectionsModal";
import { useUserModules } from "@/lib/UserModulesContext";
import {
  GuitarCategory, CATEGORY_LABELS, GUITAR_CATEGORIES,
  WatchCategory, WATCH_CATEGORY_LABELS, WATCH_CATEGORIES,
  AutoCategory, AUTO_CATEGORY_LABELS, AUTO_CATEGORIES,
  IoDCategory, IOD_CATEGORY_LABELS, IOD_CATEGORIES,
} from "@/lib/types";

// ── Chevron ───────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ── Category icons ────────────────────────────────────────────────────────────

const CategoryIcon = ({ category }: { category: GuitarCategory }) => {
  if (category === "electric-guitars") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
  if (category === "acoustic-guitars") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="14" r="5" />
      <path strokeLinecap="round" d="M12 9V4M10 4h4" />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
  if (category === "amplifiers") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="3" />
      <path strokeLinecap="round" d="M15 9h3M15 12h3M15 15h3" />
    </svg>
  );
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="7" width="16" height="10" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="12" r="1.5" />
      <path strokeLinecap="round" d="M7 7V5M17 7V5" />
    </svg>
  );
};

const WatchCategoryIcon = ({ category }: { category: WatchCategory }) => {
  if (category === "luxury-watches") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (category === "sport-watches") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" d="M12 8v4l2.5 2.5" />
      <path strokeLinecap="round" d="M9 3.5h6M9 20.5h6" />
    </svg>
  );
  if (category === "dress-watches") return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="8" y="3" width="8" height="18" rx="4" />
      <path strokeLinecap="round" d="M12 8v4l1.5 1.5" />
    </svg>
  );
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" d="M12 7v5l3 3" />
    </svg>
  );
};

// ── Collapsible section ───────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  open: boolean;
  onToggle: () => void;
  isActive: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  open,
  onToggle,
  isActive,
  href,
  icon,
  label,
  children,
}: CollapsibleSectionProps) {
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    onToggle();
  };

  return (
    <div>
      <div className={`flex items-center gap-0 mt-1 ${isActive ? "bg-surface-2 border-r-2 border-accent" : ""}`}>
        <Link
          href={href}
          className={`flex items-center gap-4 px-6 py-3.5 text-sm font-semibold uppercase tracking-wider transition-all duration-200 flex-1 min-w-0 ${
            isActive ? "text-accent" : "text-text-dim hover:text-text hover:bg-surface-2"
          }`}
        >
          {icon}
          <span className="truncate">{label}</span>
        </Link>
        <button
          onClick={toggle}
          className={`pr-4 py-3.5 transition-colors ${isActive ? "text-accent" : "text-text-dim hover:text-text"}`}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        >
          <Chevron open={open} />
        </button>
      </div>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "500px" : "0px" }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Sub-nav link ──────────────────────────────────────────────────────────────

function SubLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 pl-10 pr-6 py-3 text-xs font-medium uppercase tracking-widest transition-all duration-200 ${
        active
          ? "bg-surface-2 border-r-2 border-accent text-accent"
          : "text-text-dim hover:text-text hover:bg-surface-2"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

type VaultSection = "guitars" | "watches" | "automobiles" | "collectibles";

function activeSection(pathname: string): VaultSection | null {
  if (pathname.startsWith("/guitars"))      return "guitars";
  if (pathname.startsWith("/watches"))      return "watches";
  if (pathname.startsWith("/automobiles"))  return "automobiles";
  if (pathname.startsWith("/collectibles")) return "collectibles";
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isEnabled } = useUserModules();
  const [showImportExport, setShowImportExport] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showManageCollections, setShowManageCollections] = useState(false);

  const isDashboardActive = pathname === "/";
  const isGuitarsActive   = pathname.startsWith("/guitars");
  const isWatchesActive   = pathname.startsWith("/watches");
  const isAutosActive     = pathname.startsWith("/automobiles");
  const isIoDActive       = pathname.startsWith("/collectibles");
  const isPaperworkActive = pathname.startsWith("/paperwork");

  // CUR-7: The Paperwork section is always visible (NOT gated by useUserModules).
  const [paperworkOpen, setPaperworkOpen] = useState<boolean>(isPaperworkActive);
  useEffect(() => { if (isPaperworkActive) setPaperworkOpen(true); }, [isPaperworkActive]);

  // Open state for each Vault section — lifted here so navigation auto-collapses inactive ones
  const [openSections, setOpenSections] = useState<Record<VaultSection, boolean>>({
    guitars:      isGuitarsActive,
    watches:      isWatchesActive,
    automobiles:  isAutosActive,
    collectibles: isIoDActive,
  });

  // When the route changes: open the active section, collapse all others
  useEffect(() => {
    const current = activeSection(pathname);
    setOpenSections({
      guitars:      current === "guitars",
      watches:      current === "watches",
      automobiles:  current === "automobiles",
      collectibles: current === "collectibles",
    });
  }, [pathname]);

  const toggleSection = (key: VaultSection) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const userInitial = session?.user?.name
    ? session.user.name.charAt(0).toUpperCase()
    : session?.user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0c0e10] border-r border-border flex flex-col h-full overflow-y-auto">
      {/* Branding */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        <Image
          src="/brand/vault1-medallion.png"
          alt="Vault 1"
          width={40}
          height={40}
          priority
          className="flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="font-headline text-base font-semibold text-accent tracking-wider leading-none">
            Vault 1
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim mt-1">Obsession, Curated</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex items-center gap-4 px-6 py-3.5 text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${
            isDashboardActive
              ? "bg-surface-2 border-r-2 border-accent text-accent"
              : "text-text-dim hover:text-text hover:bg-surface-2"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span>Dashboard</span>
        </Link>

        {/* ── The Vault label ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-[9px] uppercase tracking-[0.3em] text-text-dim/60 font-label">The Vault</p>
        </div>

        {/* ── Guitars ── */}
        {isEnabled("guitars") && (
          <CollapsibleSection
            open={openSections.guitars}
            onToggle={() => toggleSection("guitars")}
            isActive={isGuitarsActive}
            href="/guitars"
            label="Guitars"
            icon={
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            }
          >
            {GUITAR_CATEGORIES.map((cat) => (
              <SubLink
                key={cat}
                href={`/guitars/${cat}`}
                active={pathname === `/guitars/${cat}`}
                icon={<CategoryIcon category={cat} />}
                label={CATEGORY_LABELS[cat]}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* ── Watches ── */}
        {isEnabled("watches") && (
          <CollapsibleSection
            open={openSections.watches}
            onToggle={() => toggleSection("watches")}
            isActive={isWatchesActive}
            href="/watches"
            label="Watches"
            icon={
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            {WATCH_CATEGORIES.map((cat) => (
              <SubLink
                key={cat}
                href={`/watches/${cat}`}
                active={pathname === `/watches/${cat}`}
                icon={<WatchCategoryIcon category={cat} />}
                label={WATCH_CATEGORY_LABELS[cat]}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* ── Automobiles ── */}
        {isEnabled("automobiles") && (
          <CollapsibleSection
            open={openSections.automobiles}
            onToggle={() => toggleSection("automobiles")}
            isActive={isAutosActive}
            href="/automobiles"
            label="Automobiles"
            icon={
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l2-6h14l2 6M1 16h22M5 16v2M19 16v2M8 10h8" />
              </svg>
            }
          >
            {AUTO_CATEGORIES.map((cat) => (
              <SubLink
                key={cat}
                href={`/automobiles/${cat}`}
                active={pathname === `/automobiles/${cat}`}
                label={AUTO_CATEGORY_LABELS[cat as AutoCategory]}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* ── Collectibles ── */}
        {isEnabled("collectibles") && (
          <CollapsibleSection
            open={openSections.collectibles}
            onToggle={() => toggleSection("collectibles")}
            isActive={isIoDActive}
            href="/collectibles"
            label="Collectibles"
            icon={
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />
              </svg>
            }
          >
            {IOD_CATEGORIES.map((cat) => (
              <SubLink
                key={cat}
                href={`/collectibles/${cat}`}
                active={pathname === `/collectibles/${cat}`}
                label={IOD_CATEGORY_LABELS[cat as IoDCategory]}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* ── The Paperwork (CUR-7) ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-[9px] uppercase tracking-[0.3em] text-text-dim/60 font-label">The Paperwork</p>
        </div>

        <CollapsibleSection
          open={paperworkOpen}
          onToggle={() => setPaperworkOpen((v) => !v)}
          isActive={isPaperworkActive}
          href="/paperwork/insurance"
          label="Paperwork"
          icon={
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        >
          <SubLink
            href="/paperwork/insurance"
            active={pathname === "/paperwork/insurance"}
            icon={
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            }
            label="Insurance"
          />
        </CollapsibleSection>

        {/* ── The Pursuit ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-[9px] uppercase tracking-[0.3em] text-text-dim/60 font-label">The Pursuit</p>
        </div>

        {[
          {
            key: "guitars" as const,
            href: "/pursuit/guitars",
            label: "Guitars",
            icon: (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            ),
          },
          {
            key: "watches" as const,
            href: "/pursuit/watches",
            label: "Watches",
            icon: (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            key: "automobiles" as const,
            href: "/pursuit/automobiles",
            label: "Automobiles",
            icon: (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l2-6h14l2 6M1 16h22M5 16v2M19 16v2M8 10h8" />
              </svg>
            ),
          },
          {
            key: "collectibles" as const,
            href: "/pursuit/collectibles",
            label: "Collectibles",
            icon: (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />
              </svg>
            ),
          },
        ]
          .filter(({ key }) => isEnabled(key))
          .map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 px-6 py-3.5 text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${
                pathname === href
                  ? "bg-surface-2 border-r-2 border-accent text-accent"
                  : "text-text-dim hover:text-text hover:bg-surface-2"
              }`}
            >
              {icon}
              <span className="truncate">{label}</span>
            </Link>
          ))}
      </nav>

      {/* User info */}
      {session?.user && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-accent text-[#0c0e10] font-bold text-sm flex items-center justify-center flex-shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text truncate">{session.user.name || "User"}</p>
              <p className="text-[10px] text-text-muted truncate">{session.user.email}</p>
            </div>
            <button
              onClick={() => setShowManageCollections(true)}
              className="text-text-dim hover:text-text transition-colors flex-shrink-0"
              title="Manage collections"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-text-dim hover:text-text transition-colors flex-shrink-0"
              title="Sign out"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Import / Export */}
      <div className="px-4 py-4">
        <button
          onClick={() => setShowImportExport(true)}
          className="w-full vault-gradient text-on-primary font-bold text-xs uppercase tracking-widest py-3 rounded shadow-lg shadow-primary/10 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Import / Export
        </button>
        <button
          onClick={() => setShowMarketplace(true)}
          className="w-full mt-2 text-text-muted hover:text-text border border-border hover:border-accent/40 font-medium text-xs uppercase tracking-widest py-2.5 rounded transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Marketplace
        </button>
      </div>

      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} />
      )}
      {showMarketplace && (
        <MarketplaceModal onClose={() => setShowMarketplace(false)} />
      )}
      {showManageCollections && (
        <ManageCollectionsModal onClose={() => setShowManageCollections(false)} />
      )}

      {/* Footer */}
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-text-dim font-label">Vault 1 v0.1</p>
      </div>
    </aside>
  );
}
