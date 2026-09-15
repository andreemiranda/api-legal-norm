import React from "react";
import { AdSenseBanner } from "./AdSenseBanner";
import { getSiteDomain } from "../utils/domain";
import { useFirebaseAuth } from "../services/firebaseAuthService";
import {
  Scale,
  Shield,
  Sliders,
  Mail,
  FileCode,
  ExternalLink,
  ChevronRight,
  Globe,
  Activity,
} from "lucide-react";

interface FooterProps {
  onNavigate: (view: string) => void;
  currentView: string;
  onOpenConsentSettings: () => void;
  onOpenAdminMetrics?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  currentView,
  onOpenConsentSettings,
  onOpenAdminMetrics,
}) => {
  const currentYear = new Date().getFullYear();
  const domain = getSiteDomain();
  const authState = useFirebaseAuth();

  const handleCookiePrefClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof onOpenConsentSettings === "function") {
      onOpenConsentSettings();
    }
  };

  return (
    <footer id="main-footer" className="w-full bg-slate-950 text-slate-300 border-t border-blue-900/60 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Footer Ad Slot */}
        <div className="mb-10 max-w-4xl mx-auto">
          <AdSenseBanner slotType="footer" />
        </div>

        {/* 4-Column Navigation Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-900">
          {/* Column 1: Brand & Editorial Purpose */}
          <div className="space-y-3.5">
            <div
              onClick={() => onNavigate("home")}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-700 to-slate-900 border border-blue-500/40 flex items-center justify-center p-2">
                <Scale className="w-6 h-6 text-blue-200" />
              </div>
              <span className="font-serif text-xl font-bold text-white tracking-wider uppercase">
                Norma <span className="text-blue-400">Jurídica</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Portal de Notícias Avançado e Responsivo. Plataforma digital de jornalismo moderno, desenvolvida com foco em alta performance, apuração precisa e conteúdo jornalístico de qualidade.
            </p>

            <div className="pt-2 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono text-slate-400">{domain}</span>
              </div>
              <p>Cobertura Nacional • Brasília - DF</p>
            </div>
          </div>

          {/* Column 2: Legal Documents & Privacy */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-blue-900/40 pb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Documentos Legais & Privacidade</span>
            </h4>

            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate("privacidade")}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "privacidade" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span>Política de Privacidade</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => onNavigate("termos")}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "termos" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span>Termos de Uso</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => onNavigate("cookies")}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "cookies" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span>Política de Cookies</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => onNavigate("lgpd")}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "lgpd" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-emerald-400" />
                  <span className="font-medium">Tratamento de Dados Pessoais</span>
                </button>
              </li>

              <li>
                <button
                  id="footer-nav-consentimento-btn"
                  onClick={handleCookiePrefClick}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "consentimento" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <Sliders className="w-3 h-3 text-blue-400" />
                  <span>Gerenciamento de Consentimento</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Institutional & Contato */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-blue-900/40 pb-2">
              <Mail className="w-4 h-4 text-blue-400" />
              <span>Contato</span>
            </h4>

            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate("contato")}
                  className={`flex items-center gap-1.5 hover:text-blue-300 transition-colors ${
                    currentView === "contato" ? "text-blue-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span>Formulário de Contato</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => onNavigate("lgpd")}
                  className="flex items-center gap-1.5 hover:text-blue-300 transition-colors text-slate-300"
                >
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span>Solicitações de Privacidade</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: SEO, Sitemaps & Technical files */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-blue-900/40 pb-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Indexação & Arquivos Técnicos</span>
            </h4>

            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-slate-300 hover:text-blue-300 transition-colors"
                >
                  <span>Sitemap XML Principal</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>

              <li>
                <a
                  href="/sitemap-news.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-slate-300 hover:text-blue-300 transition-colors"
                >
                  <span>Sitemap de Notícias</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>

              <li>
                <a
                  href="/sitemap-categories.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-slate-300 hover:text-blue-300 transition-colors"
                >
                  <span>Sitemap de Editorias</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>

              <li>
                <a
                  href="/sitemap-images.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-slate-300 hover:text-blue-300 transition-colors"
                >
                  <span>Sitemap de Imagens</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Cookie Preferences Link */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} Norma Jurídica. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              id="footer-cookie-preferences-button"
              onClick={handleCookiePrefClick}
              className="text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-medium"
            >
              <Sliders className="w-3 h-3" />
              <span>Preferências de Cookies</span>
            </button>

            {authState.isAdmin && onOpenAdminMetrics && (
              <button
                id="footer-admin-metrics-button"
                onClick={onOpenAdminMetrics}
                className="text-slate-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                title="Painel de Metas, Tráfego & Firebase (Acesso Restrito a Administradores)"
              >
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>Meta & Tráfego</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
