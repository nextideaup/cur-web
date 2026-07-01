export interface ComparableSale {
  source: string;
  title: string;
  price: number;
  date: string;
  url?: string;
  condition?: string;
  listing_type?: "sold" | "for_sale";
}

// A single freeform spec row (migration 019 / CUR-1 flip-sell groundwork).
// Stored in the `specs` JSONB array on every item table.
//   - source "ai":     produced by the per-module specs handler (web_search).
//   - source "manual": user-entered; survives AI refreshes (AI re-runs replace
//                      only the 'ai' rows, never a manual override).
export interface SpecEntry {
  label: string;
  value: string;
  source: "ai" | "manual";
}

// Mixed into every item type below so the shared SpecsEditor / SpecsSection can
// accept any item. `specs` is null until the first AI generation or manual save.
export interface SpecFields {
  specs?: SpecEntry[] | null;
  specs_updated_at?: string | null;
  // AI-generated (and user-editable) opening paragraph for marketplace listings
  // (migration 022). Null until generated.
  listing_intro?: string | null;
  // Per-listing footer override (migration 023). Null = use the seller's default.
  listing_footer?: string | null;
}

export interface GuitarValuation {
  id: string;
  guitar_item_id: string;
  valuation_type: "ai" | "user";
  price: number;
  notes: string | null;
  comparable_sales: ComparableSale[] | null;
  created_at: string;
}

export type GuitarCategory =
  | "electric-guitars"
  | "acoustic-guitars"
  | "amplifiers"
  | "pedals";

export type Condition =
  | "Mint"
  | "Excellent"
  | "Very Good"
  | "Good"
  | "Fair"
  | "Poor";

// Source of an item's `insurance_value` field (CUR-2 / CUR-3).
//   - "ai":                  derived from a fresh AI sale-price valuation × the
//                            per-category multiplier from `insurance_valuation_norms`.
//   - "alternate_from_user": derived from the user's `purchase_price` × multiplier
//                            (lower confidence — used when no AI value exists).
//   - "user_override":       the user manually entered an insurance value, which
//                            takes precedence over future auto-computed values.
export type InsuranceValueSource = "ai" | "alternate_from_user" | "user_override";

// Fields added to every item type by CUR-2 / CUR-3 (Insurance Validation and
// Paperwork Epic). Composed into GuitarItem, WatchItem, AutoItem, IoDItem
// below so the shared <InsuranceValueRow> can accept any item.
export interface InsuranceFields {
  insure?: boolean;
  insurance_value?: number | null;
  insurance_value_source?: InsuranceValueSource | null;
  insurance_value_date?: string | null;
  archived_at?: string | null;
}

export interface GuitarImage {
  id: string;
  guitar_item_id: string;
  filename: string;
  original_name: string | null;
  path: string;
  mime_type: string | null;
  size: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface GuitarItem extends InsuranceFields, SpecFields {
  id: string;
  category: GuitarCategory;
  brand: string;
  model: string;
  year: number | null;
  serial_number: string | null;
  condition: Condition;
  purchase_price: number | null;
  purchase_source: string | null;
  color_finish: string | null;
  short_description: string | null;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  images?: GuitarImage[];
  latest_ai_price?: number | null;
  latest_ai_price_date?: string | null;
  latest_user_price?: number | null;
  latest_user_price_date?: string | null;
}

export interface GuitarItemWithImages extends GuitarItem {
  images: GuitarImage[];
}

export const CATEGORY_LABELS: Record<GuitarCategory, string> = {
  "electric-guitars": "Electric Guitars",
  "acoustic-guitars": "Acoustic Guitars",
  amplifiers: "Amplifiers",
  pedals: "Pedals",
};

export const CATEGORY_ICONS: Record<GuitarCategory, string> = {
  "electric-guitars": "⚡",
  "acoustic-guitars": "🎸",
  amplifiers: "🔊",
  pedals: "🎛️",
};

export const CONDITION_COLORS: Record<Condition, string> = {
  Mint: "bg-emerald-900/40 text-emerald-400 border-emerald-700/40",
  Excellent: "bg-sky-900/40 text-sky-400 border-sky-700/40",
  "Very Good": "bg-teal-900/40 text-teal-400 border-teal-700/40",
  Good: "bg-amber-900/40 text-amber-400 border-amber-700/40",
  Fair: "bg-orange-900/40 text-orange-400 border-orange-700/40",
  Poor: "bg-red-900/40 text-red-400 border-red-700/40",
};

export const GUITAR_CATEGORIES: GuitarCategory[] = [
  "electric-guitars",
  "acoustic-guitars",
  "amplifiers",
  "pedals",
];

export const CONDITIONS: Condition[] = [
  "Mint",
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
  "Poor",
];

// ── Watch Types ────────────────────────────────────────────────────────────────

export type WatchCategory =
  | "luxury-watches"
  | "sport-watches"
  | "dress-watches"
  | "vintage-watches";

export interface WatchImage {
  id: string;
  watch_item_id: string;
  filename: string;
  original_name: string | null;
  path: string;
  mime_type: string | null;
  size: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface WatchItem extends InsuranceFields, SpecFields {
  id: string;
  category: WatchCategory;
  brand: string;
  model: string;
  year: number | null;
  reference_number: string | null;
  case_diameter: string | null;
  serial_number: string | null;
  condition: Condition;
  purchase_price: number | null;
  purchase_source: string | null;
  dial_color: string | null;
  country_of_manufacture: string | null;
  movement: string | null;
  bracelet_material: string | null;
  case_material: string | null;
  short_description: string | null;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  images?: WatchImage[];
  latest_ai_price?: number | null;
  latest_ai_price_date?: string | null;
  latest_user_price?: number | null;
  latest_user_price_date?: string | null;
}

export interface WatchValuation {
  id: string;
  watch_item_id: string;
  valuation_type: "ai" | "user";
  price: number;
  notes: string | null;
  comparable_sales: ComparableSale[] | null;
  created_at: string;
}

export const WATCH_CATEGORY_LABELS: Record<WatchCategory, string> = {
  "luxury-watches": "Luxury Watches",
  "sport-watches": "Sport Watches",
  "dress-watches": "Dress Watches",
  "vintage-watches": "Vintage Watches",
};

export const WATCH_CATEGORY_ICONS: Record<WatchCategory, string> = {
  "luxury-watches": "✨",
  "sport-watches": "🏆",
  "dress-watches": "🎩",
  "vintage-watches": "⌛",
};

export const WATCH_CATEGORIES: WatchCategory[] = [
  "luxury-watches",
  "sport-watches",
  "dress-watches",
  "vintage-watches",
];

// ── Pursuit Types ──────────────────────────────────────────────────────────────

export type PursuitStatus = "active" | "found" | "paused";

export interface GuitarPursuit {
  id: string;
  brand: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  color_finish: string | null;
  price_min: number | null;
  price_max: number | null;
  sources: string[];
  facebook_location: string | null;
  exclude_terms: string | null;
  notes: string | null;
  status: PursuitStatus;
  checkin_snoozed_until: string | null;
  checkin_dismissed: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchPursuit {
  id: string;
  brand: string | null;
  model: string | null;
  reference_number: string | null;
  case_diameter: string | null;
  dial_color: string | null;
  materials: string | null;
  price_min: number | null;
  price_max: number | null;
  sources: string[];
  facebook_location: string | null;
  other_source: string | null;
  exclude_terms: string | null;
  notes: string | null;
  status: PursuitStatus;
  checkin_snoozed_until: string | null;
  checkin_dismissed: boolean;
  created_at: string;
  updated_at: string;
}

export const GUITAR_SOURCES: { id: string; label: string; needsLocation?: boolean }[] = [
  { id: "reverb",         label: "Reverb" },
  { id: "ebay",           label: "eBay" },
  { id: "guitar_center",  label: "Guitar Center Used" },
  { id: "facebook",       label: "Facebook Marketplace", needsLocation: true },
  { id: "craigslist",     label: "Craigslist",           needsLocation: true },
  { id: "sweetwater",     label: "Sweetwater Used" },
];

export const WATCH_SOURCES: { id: string; label: string; needsLocation?: boolean }[] = [
  { id: "chrono24",    label: "Chrono24" },
  { id: "ebay",        label: "eBay" },
  { id: "watchbox",    label: "WatchBox" },
  { id: "bobs_watches",label: "Bob's Watches" },
  { id: "jomashop",    label: "Jomashop" },
  { id: "facebook",    label: "Facebook Marketplace", needsLocation: true },
  { id: "google",      label: "Google Shopping" },
  { id: "other",       label: "Other" },
];

export const PURSUIT_STATUS_STYLES: Record<PursuitStatus, string> = {
  active: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40",
  found:  "bg-accent/10 text-accent border border-accent/30",
  paused: "bg-surface-3 text-text-dim border border-border",
};

// ── Automobile Types ──────────────────────────────────────────────────────────

export type AutoCategory = "collection" | "household";

export interface AutoImage {
  id: string;
  auto_id: string;
  filename: string;
  original_name: string | null;
  path: string;
  mime_type: string | null;
  size: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface AutoItem extends InsuranceFields, SpecFields {
  id: string;
  category: AutoCategory;
  brand: string;
  model: string;
  year: number | null;
  description: string | null;
  trim_level: string | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | null;
  condition: Condition | null;
  body_style: string | null;
  color: string | null;
  vin: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  images?: AutoImage[];
  latest_ai_price?: number | null;
  latest_ai_price_date?: string | null;
  latest_user_price?: number | null;
  latest_user_price_date?: string | null;
}

export const AUTO_CATEGORIES: AutoCategory[] = ["collection", "household"];

export const AUTO_CATEGORY_LABELS: Record<AutoCategory, string> = {
  collection: "Collection Cars",
  household:  "Household Vehicles",
};

// ── Collectibles Types ────────────────────────────────────────────────

export type IoDCategory = "fine-art" | "memorabilia" | "collectibles" | "jewelry" | "other";

export interface IoDImage {
  id: string;
  iod_id: string;
  filename: string;
  original_name: string | null;
  path: string;
  mime_type: string | null;
  size: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface IoDItem extends InsuranceFields, SpecFields {
  id: string;
  category: IoDCategory;
  item_type: string | null;
  brand: string | null;
  short_description: string;
  long_description: string | null;
  year: number | null;
  condition: Condition | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  provenance: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  images?: IoDImage[];
  latest_ai_price?: number | null;
  latest_ai_price_date?: string | null;
  latest_user_price?: number | null;
  latest_user_price_date?: string | null;
}

export const IOD_CATEGORIES: IoDCategory[] = ["fine-art", "memorabilia", "collectibles", "jewelry", "other"];

export const IOD_CATEGORY_LABELS: Record<IoDCategory, string> = {
  "fine-art":    "Fine Art",
  memorabilia:   "Memorabilia",
  collectibles:  "Collectibles",
  jewelry:       "Jewelry",
  other:         "Other",
};

// ── Auto Pursuit ──────────────────────────────────────────────────────────────

export interface AutoPursuit {
  id: string;
  brand: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  body_style: string | null;
  color: string | null;
  mileage_max: number | null;
  price_min: number | null;
  price_max: number | null;
  sources: string[];
  facebook_location: string | null;
  exclude_terms: string | null;
  notes: string | null;
  status: PursuitStatus;
  created_at: string;
  updated_at: string;
}

export interface IoDPursuit {
  id: string;
  item_type: string | null;
  brand: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  sources: string[];
  exclude_terms: string | null;
  notes: string | null;
  status: PursuitStatus;
  created_at: string;
  updated_at: string;
}

export const AUTO_SOURCES: { id: string; label: string; needsLocation?: boolean }[] = [
  { id: "autotrader",      label: "AutoTrader" },
  { id: "cars_com",        label: "Cars.com" },
  { id: "cargurus",        label: "CarGurus" },
  { id: "ebay_motors",     label: "eBay Motors" },
  { id: "bring_a_trailer", label: "Bring a Trailer" },
  { id: "facebook",        label: "Facebook Marketplace", needsLocation: true },
  { id: "carmax",          label: "CarMax" },
];

export const IOD_SOURCES: { id: string; label: string }[] = [
  { id: "ebay",              label: "eBay" },
  { id: "etsy",              label: "Etsy" },
  { id: "heritage_auctions", label: "Heritage Auctions" },
  { id: "sothebys",          label: "Sotheby's" },
  { id: "christies",         label: "Christie's" },
  { id: "invaluable",        label: "Invaluable" },
  { id: "google",            label: "Google Shopping" },
];
