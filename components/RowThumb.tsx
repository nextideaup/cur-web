"use client";

import { useState } from "react";

// Minimal structural shape common to every module's image row
// (GuitarImage / WatchImage / AutoImage / IoDImage all satisfy it).
interface ThumbImage {
  path: string;
  is_primary: boolean;
}

// Small primary-photo thumbnail for a list view's first column. Own error state
// so a missing/broken image falls back to a placeholder without affecting the
// row. Shared across all four collection list views.
export default function RowThumb({ images }: { images?: ThumbImage[] }) {
  const [err, setErr] = useState(false);
  const img = images?.find((i) => i.is_primary) ?? images?.[0];
  return (
    <div className="w-10 h-10 rounded-md overflow-hidden bg-surface-2 flex items-center justify-center shrink-0">
      {img && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.path} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <svg className="w-5 h-5 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h15a3 3 0 003-3v-9a3 3 0 00-3-3h-15zm4.06 3.31a1.5 1.5 0 11-2.12 2.13 1.5 1.5 0 012.12-2.13zM3 15.53l3.44-3.44a.75.75 0 011.06 0l1.72 1.72 4.19-4.19a.75.75 0 011.06 0L21 14.84" />
        </svg>
      )}
    </div>
  );
}
