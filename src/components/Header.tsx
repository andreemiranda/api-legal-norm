import React, { useState } from "react";
import { CategoryItem } from "../types";
import { AdSenseBanner } from "./AdSenseBanner";
import {
  Scale,
  Calendar,
  Search,
  ShieldCheck,
  Phone,
  FileText,
  Sliders,
  Layers,
  X,
  ChevronDown
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
}) => {
  const [showCategoryFilterInput, setShowCategoryFilterInput] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Date & Edition */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-blue-300 font-medium capitalize">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {todayFormatted}
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline text-slate-400">Edição Digital Nacional</span>
          </div>

          {/* Quick Institutional & Compliance Links */}
          <div className="flex items-center gap-3 sm:gap-4 text-[11px]">
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
          </div>
        </div>
      </div>

      {/* 2. Main Brand & Header Ad Area */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          {/* Logo Brand */}
          <div
            onClick={() => {
              onNavigate("home");
              onSelectCategory("Todas");
            }}
            className="cursor-pointer group flex items-center gap-3.5 text-center lg:text-left select-none"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 border border-blue-500/40 p-2.5 flex items-center justify-center shadow-lg shadow-blue-950/50 group-hover:border-blue-400 transition-all">
              <Scale className="w-9 h-9 text-blue-200 group-hover:scale-105 transition-transform" />
            </div>

            <div>
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="font-serif text-2xl sm:text-3xl font-extrabold tracking-wider text-white uppercase drop-shadow-sm">
                  Norma <span className="text-blue-400">Jurídica</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-700/50 text-blue-300 font-sans tracking-wide">
                  PORTAL OFICIAL
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
              className="w-full bg-slate-900/90 border border-blue-900/40 focus:border-blue-500 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => onSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Top Menu With Editorias */}
      <div className="bg-slate-900/95 border-t border-blue-900/50 px-4 py-2.5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Editorias
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryFilterInput(!showCategoryFilterInput)}
                className="text-[11px] text-blue-300 hover:text-white flex items-center gap-1 bg-blue-950/70 hover:bg-blue-900 px-2 py-0.5 rounded border border-blue-800/40"
              >
                <Search className="w-2.5 h-2.5" />
                {showCategoryFilterInput ? "Ocultar busca" : "Filtrar editoria"}
              </button>
            </div>
          </div>

          {/* Quick Filter Input */}
          {showCategoryFilterInput && (
            <div className="mb-2.5 relative max-w-xs">
              <input
                type="text"
                placeholder="Filtrar editoria pelo nome..."
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-blue-700/60 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none"
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
              <span className="text-[10px] opacity-75 font-mono">({totalNewsCount})</span>
            </button>

            {/* All 50 Categories */}
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
                  {item.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-blue-800 text-blue-100" : "bg-slate-700/80 text-blue-300"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
