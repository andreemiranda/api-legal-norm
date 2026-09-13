import React, { useState, useEffect } from "react";
import { CategoryItem } from "../types";
import { AdSenseBanner } from "./AdSenseBanner";
import { AuthModal } from "./AuthModal";
import { useFirebaseAuth, firebaseAuthService } from "../services/firebaseAuthService";
import {
  Scale,
  Calendar,
  Search,
  ShieldCheck,
  Phone,
  Sliders,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Activity,
  User,
  ChevronDown,
} from "lucide-react";

interface HeaderProps {
  categories: CategoryItem[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onNavigate: (view: string) => void;
  currentView: string;
  onSearch: (term: string) => void;
  searchTerm: string;
  totalNewsCount?: number;
  onOpenSourcesModal: () => void;
  onOpenMetrics?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onNavigate,
  currentView,
  onSearch,
  searchTerm,
  totalNewsCount = 660,
  onOpenSourcesModal,
  onOpenMetrics,
}) => {
  const [showCategoryFilterInput, setShowCategoryFilterInput] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Auth State via singleton hook
  const authState = useFirebaseAuth();

  // Theme State: Default is 'dark' (as required), click toggles to 'light'
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("nj_theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
      localStorage.setItem("nj_theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Today formatted in PT-BR
  const todayFormatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const filteredCategories = categories.filter((c) =>
    c.category.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  return (
    // Non-fixed header: scrolls naturally with the page
    <header id="main-header" className="relative w-full bg-slate-950 text-slate-100 border-b border-blue-900/60 shadow-xl">
      {/* 1. Top Utility Bar */}
      <div className="bg-slate-900 border-b border-blue-950/80 px-4 py-1.5 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Date & Edition */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-blue-300 font-medium capitalize">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {todayFormatted}
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline text-slate-400">Edição Digital Nacional</span>
          </div>

          {/* Institutional Links, Theme Toggle & Authentication */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 text-[11px]">
            <button
              onClick={() => onNavigate("privacidade")}
              className={`flex items-center gap-1 hover:text-blue-300 transition-colors ${
                currentView === "privacidade" ? "text-blue-400 font-semibold" : "text-slate-300"
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Privacidade</span>
            </button>

            <button
              onClick={() => onNavigate("consentimento")}
              className={`flex items-center gap-1 hover:text-blue-300 transition-colors ${
                currentView === "consentimento" ? "text-blue-400 font-semibold" : "text-slate-300"
              }`}
            >
              <Sliders className="w-3 h-3 text-blue-400" />
              <span>Consentimento</span>
            </button>

            <button
              onClick={() => onNavigate("contato")}
              className={`flex items-center gap-1 hover:text-blue-300 transition-colors ${
                currentView === "contato" ? "text-blue-400 font-semibold" : "text-slate-300"
              }`}
            >
              <Phone className="w-3 h-3 text-amber-400" />
              <span>Contato</span>
            </button>

            <span className="text-slate-600">|</span>

            {/* Light / Dark Mode Toggle (Default: Dark, Click: Light) */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-amber-300 transition-colors border border-slate-700/50"
              title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-medium">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline font-medium">Modo Escuro</span>
                </>
              )}
            </button>

            <span className="text-slate-600">|</span>

            {/* Authentication: 'Entrar' button after Contato or User Profile when authenticated */}
            {!authState.isAuthenticated ? (
              <button
                id="header-login-button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            ) : (
              <div className="relative flex items-center gap-2">
                <div
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-blue-500/40 cursor-pointer transition-all"
                  title="Menu do Usuário"
                >
                  {authState.photoURL ? (
                    <img
                      src={authState.photoURL}
                      alt={authState.displayName || "Usuário"}
                      className="w-5 h-5 rounded-full object-cover border border-blue-400"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {(authState.displayName || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-white max-w-[110px] truncate">
                    {authState.displayName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-8 z-50 w-56 bg-slate-900 border border-blue-900/60 rounded-xl shadow-2xl p-2 text-xs text-slate-200 animate-fade-in">
                    <div className="px-3 py-2 border-b border-slate-800 mb-1">
                      <p className="font-semibold text-white truncate">{authState.displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{authState.email}</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-900/60 text-blue-300 border border-blue-700/50">
                        Administrador
                      </span>
                    </div>

                    {onOpenMetrics && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenMetrics();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 text-blue-300 transition-colors"
                      >
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Painel de Métricas & Tráfego</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        firebaseAuthService.signOut();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Brand & Header Ad Area */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          {/* Logo Brand: Uses /logo.jpg specifically for the site emblem */}
          <div
            onClick={() => {
              onNavigate("home");
              onSelectCategory("Todas");
            }}
            className="cursor-pointer group flex items-center gap-3.5 text-center lg:text-left select-none"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 border border-blue-500/40 p-1 flex items-center justify-center shadow-lg shadow-blue-950/50 group-hover:border-blue-400 transition-all overflow-hidden">
              <img
                src="/logo.jpg"
                alt="Norma Jurídica Logo"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  // If /logo.jpg is not found, fallback gracefully to Scale icon
                  e.currentTarget.style.display = "none";
                  const fallbackIcon = document.getElementById("header-scale-fallback");
                  if (fallbackIcon) fallbackIcon.style.display = "block";
                }}
              />
              <Scale id="header-scale-fallback" className="w-9 h-9 text-blue-200 hidden" />
            </div>

            <div>
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="font-serif text-2xl sm:text-3xl font-extrabold tracking-wider text-white uppercase drop-shadow-sm">
                  Norma <span className="text-blue-400">Jurídica</span>
                </span>
              </div>
              <p className="text-xs text-blue-200/80 font-serif tracking-wide mt-0.5">
                Jornalismo Jurídico, Legislação e Cobertura Nacional
              </p>
            </div>
          </div>

          {/* Header Ad Slot (Leaderboard 728x90) */}
          <div className="w-full lg:w-[650px] max-w-full">
            <AdSenseBanner slotType="header" />
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-2xl">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="search"
              placeholder="Pesquisar notícias, coberturas e reportagens..."
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Acervo Count & Dynamic Sources Modal Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSourcesModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
              title="Visualizar Fontes Oficiais e Acervo Completo"
            >
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span>Acervo: {totalNewsCount} Matérias</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. 4-Line Dynamic Horizontal Navigation Grid */}
      <div className="bg-slate-950 border-t border-blue-950/70 px-4 py-2.5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold uppercase tracking-wider text-blue-400">
                Editorias Principais
              </span>
            </div>

            {/* Mini Category Filter Input */}
            <button
              onClick={() => setShowCategoryFilterInput(!showCategoryFilterInput)}
              className="text-[11px] text-slate-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>{showCategoryFilterInput ? "Fechar busca" : "Filtrar seções"}</span>
            </button>
          </div>

          {showCategoryFilterInput && (
            <div className="mb-2 relative max-w-xs">
              <input
                type="text"
                placeholder="Buscar categoria..."
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                className="w-full text-xs px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
              />
              {categorySearchQuery && (
                <button
                  onClick={() => setCategorySearchQuery("")}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* The Editorias flex arranged naturally without scrollbar */}
          <div className="flex flex-wrap gap-1.5 py-1">
            {/* 'Todas' Reset Button */}
            <button
              onClick={() => {
                onSelectCategory("Todas");
                if (currentView !== "home") onNavigate("home");
              }}
              className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                selectedCategory === "Todas" && currentView === "home"
                  ? "bg-blue-600 text-white shadow-md font-semibold ring-1 ring-blue-400"
                  : "bg-slate-800/80 hover:bg-blue-950 text-slate-300 hover:text-white border border-slate-700/60"
              }`}
            >
              <span>Todas as Notícias</span>
            </button>

            {/* All Categories */}
            {filteredCategories.map((item, idx) => {
              const isActive = selectedCategory.toLowerCase() === item.category.toLowerCase() && currentView === "home";
              return (
                <button
                  key={`cat-head-${item.category}-${idx}`}
                  onClick={() => {
                    onSelectCategory(item.category);
                    if (currentView !== "home") onNavigate("home");
                  }}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md font-semibold ring-1 ring-blue-400"
                      : "bg-slate-800/60 hover:bg-blue-950 text-slate-300 hover:text-white border border-slate-700/40 hover:border-blue-700/60"
                  }`}
                >
                  <span>{item.category}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onOpenMetrics={onOpenMetrics}
      />
    </header>
  );
};
