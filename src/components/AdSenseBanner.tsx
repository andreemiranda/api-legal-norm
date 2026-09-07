import React from "react";
import { useConsent } from "../context/ConsentContext";
import { ExternalLink, ShieldAlert } from "lucide-react";

interface AdSenseBannerProps {
  slotType: "header" | "sidebar" | "in-article" | "footer" | "sidebar-bottom";
  className?: string;
}

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({ slotType, className = "" }) => {
  const { consent } = useConsent();

  // Retrieve client ID and ad-slot ID from environment variables
  const clientId =
    import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID ||
    import.meta.env.GOOGLE_ADSENSE_CLIENT_ID ||
    "ca-pub-0000000000000000";

  let slotId = "1234567890";
  let dimensions = "h-24 max-w-4xl";
  let label = "Leaderboard (728x90 / Responsivo)";

  if (slotType === "header") {
    slotId =
      import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_HEADER ||
      import.meta.env.GOOGLE_ADSENSE_SLOT_HEADER ||
      "1234567890";
    dimensions = "min-h-[90px] w-full";
    label = "Topo Principal (AdSlot Header)";
  } else if (slotType === "sidebar") {
    slotId =
      import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_SIDEBAR ||
      import.meta.env.GOOGLE_ADSENSE_SLOT_SIDEBAR ||
      "2345678901";
    dimensions = "min-h-[250px] w-full";
    label = "Barra Lateral (AdSlot Sidebar 300x250)";
  } else if (slotType === "sidebar-bottom") {
    slotId =
      import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
      import.meta.env.GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
      "9876543210";
    dimensions = "min-h-[250px] w-full";
    label = "Barra Lateral Inferior (AdSlot Sidebar-Bottom 300x250)";
  } else if (slotType === "in-article") {
    slotId =
      import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_IN_ARTICLE ||
      import.meta.env.GOOGLE_ADSENSE_SLOT_IN_ARTICLE ||
      "3456789012";
    dimensions = "min-h-[120px] w-full";
    label = "No Artigo (AdSlot In-Article)";
  } else if (slotType === "footer") {
    slotId =
      import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_FOOTER ||
      import.meta.env.GOOGLE_ADSENSE_SLOT_FOOTER ||
      "4567890123";
    dimensions = "min-h-[90px] w-full";
    label = "Rodapé (AdSlot Footer 728x90)";
  }

  // If user declined marketing cookies under LGPD
  if (!consent.marketing) {
    return (
      <aside
        aria-label="Publicidade desativada"
        className={`bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5 ${dimensions} ${className}`}
      >
        <ShieldAlert className="w-4 h-4 text-amber-400/80" />
        <span>Anúncios desativados pelas suas preferências de privacidade (LGPD).</span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Espaço Publicitário Google AdSense"
      className={`relative overflow-hidden bg-slate-900/70 border border-blue-900/40 hover:border-blue-700/60 transition-colors rounded-lg p-3 flex flex-col items-center justify-center text-center ${dimensions} ${className}`}
    >
      <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[10px] text-blue-300/70 uppercase tracking-widest font-semibold">
        <span>Publicidade</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </div>

      <div className="flex flex-col items-center justify-center text-slate-300 text-xs gap-1.5 px-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-800/50 text-[11px] font-mono text-blue-300">
          Google AdSense • {clientId}
        </span>
        <p className="text-slate-400 text-[11px]">
          {label} — Slot ID: <code className="text-blue-200 font-mono">{slotId}</code>
        </p>
      </div>

      {/* AdSense ins tag configured */}
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
};
