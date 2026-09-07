import React, { useState } from "react";
import { useConsent } from "../context/ConsentContext";
import {
  Sliders,
  ShieldCheck,
  Check,
  X,
  Lock,
  RotateCcw,
  Clock,
  Sparkles,
  ArrowLeft
} from "lucide-react";

interface ConsentManagementPageProps {
  onBack: () => void;
  onNavigateToPrivacy: () => void;
}

export const ConsentManagementPage: React.FC<ConsentManagementPageProps> = ({
  onBack,
  onNavigateToPrivacy,
}) => {
  const { consent, updateConsent, acceptAll, rejectNonEssential, resetConsent } = useConsent();

  const [formData, setFormData] = useState({
    functional: consent.functional,
    analytics: consent.analytics,
    marketing: consent.marketing,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    updateConsent({
      necessary: true,
      functional: formData.functional,
      analytics: formData.analytics,
      marketing: formData.marketing,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAcceptAll = () => {
    acceptAll();
    setFormData({ functional: true, analytics: true, marketing: true });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRejectNonEssential = () => {
    rejectNonEssential();
    setFormData({ functional: false, analytics: false, marketing: false });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div id="consent-management-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à página inicial</span>
      </button>

      {/* Header */}
      <div className="border-b border-blue-900/50 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Controle de Privacidade do Titular (LGPD)</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Gerenciador de Consentimento e Cookies
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Personalize livremente suas preferências de privacidade e uso de cookies neste dispositivo.
        </p>
      </div>

      {/* Proof of Consent Status Card (LGPD Art. 8 § 2) */}
      <div className="bg-slate-900/90 border border-blue-900/50 rounded-xl p-4 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-bold text-white">Comprovante de Consentimento Registrado</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            ID de Consentimento: <span className="text-blue-300">{consent.consentId}</span>
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Última alteração: {new Date(consent.updatedAt).toLocaleString("pt-BR")}
          </p>
        </div>

        <button
          onClick={resetConsent}
          className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resetar Decisão</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-700 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Suas preferências de privacidade foram atualizadas e salvas com sucesso!</span>
        </div>
      )}

      {/* Cookies Toggle List */}
      <div className="space-y-4">
        {/* Necessary */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h3 className="font-serif font-bold text-white text-base">Cookies Estritamente Necessários</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Indispensáveis para a segurança de rede, navegação, proteção contra ataques cibernéticos e para salvar seu próprio termo de consentimento. Não coletam dados para fins publicitários.
            </p>
          </div>

          <span className="shrink-0 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
            Sempre Ativo
          </span>
        </div>

        {/* Functional */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-white text-base">Cookies de Funcionalidade (Clima Local)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permitem memorizar sua localização ou cidade preferida para carregar as informações meteorológicas do sidebar sem requisitar autorização de GPS repetidamente.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formData.functional}
              onChange={(e) => setFormData({ ...formData, functional: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Analytics */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-white text-base">Cookies de Análise de Tráfego</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auxiliam nossa equipe jornalística a medir estatísticas agregadas e anônimas sobre quais matérias, ementas e notícias possuem maior repercussão pública.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formData.analytics}
              onChange={(e) => setFormData({ ...formData, analytics: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Marketing / AdSense */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-white text-base">Cookies de Publicidade (Google AdSense)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Utilizados para fornecer publicidade relevante aos leitores, viabilizando a sustentabilidade e gratuidade do portal de jornalismo jurídico. Se desativados, você continuará visualizando anúncios genéricos e não personalizados.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formData.marketing}
              onChange={(e) => setFormData({ ...formData, marketing: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Global Action Buttons */}
      <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRejectNonEssential}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
          >
            Rejeitar Não Essenciais
          </button>

          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/60 text-xs font-semibold transition-colors"
          >
            Aceitar Todos os Cookies
          </button>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md hover:shadow-blue-600/30"
        >
          Salvar Minhas Preferências
        </button>
      </div>
    </div>
  );
};
