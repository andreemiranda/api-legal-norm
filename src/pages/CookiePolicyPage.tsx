import React from "react";
import { Sliders, Cookie, Check, X, Shield, ArrowLeft } from "lucide-react";

interface CookiePolicyPageProps {
  onBack: () => void;
  onNavigateToConsent: () => void;
}

export const CookiePolicyPage: React.FC<CookiePolicyPageProps> = ({
  onBack,
  onNavigateToConsent,
}) => {
  return (
    <div id="cookie-policy-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à página inicial</span>
      </button>

      <div className="border-b border-blue-900/50 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
          <Cookie className="w-4 h-4 text-amber-400" />
          <span>Diretrizes de Rastreamento e Armazenamento Local</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Política de Cookies e Tecnologias de Rastreamento
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Atualizada em consonância com as orientações da ANPD e LGPD • Norma Jurídica
        </p>
      </div>

      <div className="bg-slate-900/80 border border-blue-900/50 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-white text-sm">Controle de Preferências Ativo</h3>
          <p className="text-xs text-slate-300 mt-1">
            Você pode alterar suas permissões ou revogar o consentimento para cookies a qualquer momento.
          </p>
        </div>
        <button
          onClick={onNavigateToConsent}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
        >
          Abrir Gerenciador de Consentimento
        </button>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">1. O que são Cookies?</h2>
          <p>
            Cookies são pequenos arquivos de texto enviados pelo servidor web e armazenados no seu navegador para registrar informações sobre sua navegação, suas preferências de idioma, tema e permitir recursos personalizados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">2. Categorias de Cookies Utilizados</h2>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">1. Cookies Estritamente Necessários</span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">Sempre Ativos</span>
              </div>
              <p className="text-slate-400">
                Garantem a segurança das sessões, previnem ataques CSRF e salvam a sua própria escolha de consentimento da LGPD no <code>localStorage</code>. Não podem ser desativados sem comprometer a integridade da aplicação.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">2. Cookies de Funcionalidade e Localização</span>
                <span className="text-[10px] text-blue-300 font-mono bg-blue-950 px-2 py-0.5 rounded border border-blue-800/40">Opcional</span>
              </div>
              <p className="text-slate-400">
                Guardam temporariamente a cidade selecionada pelo usuário para carregar os dados meteorológicos em tempo real (Open-Meteo) sem requisitar a permissão de GPS a cada recarregamento de página.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">3. Cookies Analíticos e de Audiência</span>
                <span className="text-[10px] text-blue-300 font-mono bg-blue-950 px-2 py-0.5 rounded border border-blue-800/40">Opcional</span>
              </div>
              <p className="text-slate-400">
                Ajudam a redação a entender quais matérias, súmulas e editorias são mais lidas, com anonimização de IP conforme guias da ANPD.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">4. Cookies de Publicidade (Google AdSense)</span>
                <span className="text-[10px] text-amber-300 font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-800/40">Opcional</span>
              </div>
              <p className="text-slate-400">
                Permitem ao Google e seus parceiros veicular anúncios contextualizados no portal. Podem ser desativados sem qualquer prejuízo à leitura de notícias.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">3. Como Desativar Cookies no seu Navegador</h2>
          <p>
            Além do nosso Gerenciador de Consentimento, você pode bloquear ou excluir cookies diretamente nas preferências de segurança de qualquer navegador moderno (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
          </p>
        </section>
      </div>
    </div>
  );
};
