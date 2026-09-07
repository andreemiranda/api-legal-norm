import React, { useState } from "react";
import { useConsent } from "../context/ConsentContext";
import { ShieldCheck, Sliders, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface CookieBannerProps {
  onNavigateToConsent: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onNavigateToConsent }) => {
  const { showBanner, acceptAll, rejectNonEssential, updateConsent, consent } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [customPrefs, setCustomPrefs] = useState({
    analytics: consent.analytics,
    marketing: consent.marketing,
    functional: consent.functional,
  });

  if (!showBanner) return null;

  const handleSaveCustom = () => {
    updateConsent({
      necessary: true,
      analytics: customPrefs.analytics,
      marketing: customPrefs.marketing,
      functional: customPrefs.functional,
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Aviso de Privacidade e Consentimento LGPD"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xl z-50 bg-slate-950/95 backdrop-blur-md border border-blue-800/80 rounded-2xl shadow-2xl p-5 text-slate-200 transition-all animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-900/60 border border-blue-700/50 shrink-0 mt-0.5">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-sm font-bold text-white tracking-wide">
              Privacidade & Consentimento • LGPD Brasil
            </h4>
            <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-full font-mono">
              Lei 13.709/18
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mt-2">
            O portal <strong>Norma Jurídica</strong> utiliza cookies e tecnologias semelhantes para aprimorar sua experiência de navegação, analisar tráfego editorial, exibir publicidade ética (Google AdSense) e identificar sua cidade para fornecer a previsão do tempo em tempo real.
          </p>

          {/* Expandable options */}
          {showDetails && (
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2.5 text-xs bg-slate-900/80 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">Cookies Necessários</span>
                  <p className="text-[11px] text-slate-400">Essenciais para navegação e segurança (sempre ativos).</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Obrigatório
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="font-semibold text-slate-200">Cookies Analíticos</span>
                  <p className="text-[11px] text-slate-400">Estatísticas anônimas de visualização de notícias.</p>
                </div>
                <input
                  type="checkbox"
                  checked={customPrefs.analytics}
                  onChange={(e) => setCustomPrefs({ ...customPrefs, analytics: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="font-semibold text-slate-200">Cookies de Publicidade (AdSense)</span>
                  <p className="text-[11px] text-slate-400">Exibição de anúncios relevantes do Google.</p>
                </div>
                <input
                  type="checkbox"
                  checked={customPrefs.marketing}
                  onChange={(e) => setCustomPrefs({ ...customPrefs, marketing: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="font-semibold text-slate-200">Cookies de Funcionalidade</span>
                  <p className="text-[11px] text-slate-400">Memorização de cidade local para previsão do tempo.</p>
                </div>
                <input
                  type="checkbox"
                  checked={customPrefs.functional}
                  onChange={(e) => setCustomPrefs({ ...customPrefs, functional: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-700"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 pt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-300 hover:text-white flex items-center gap-1 font-medium transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showDetails ? "Recolher Opções" : "Personalizar"}</span>
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <div className="flex items-center gap-2">
              {showDetails ? (
                <button
                  onClick={handleSaveCustom}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Salvar Preferências
                </button>
              ) : (
                <>
                  <button
                    onClick={rejectNonEssential}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all"
                  >
                    Rejeitar Não Essenciais
                  </button>

                  <button
                    onClick={acceptAll}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all hover:shadow-blue-600/30"
                  >
                    Aceitar Todos
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
