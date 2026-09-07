import React, { useState } from "react";
import { CategoryItem } from "../types";
import { WeatherBanner } from "./WeatherBanner";
import { AdSenseBanner } from "./AdSenseBanner";
import {
  FolderTree,
  Search,
  ChevronRight
} from "lucide-react";

interface RightSidebarProps {
  categories: CategoryItem[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenSourcesModal?: () => void;
  totalSourcesCount?: number;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategories = categories.filter((c) =>
    c.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside id="right-sidebar" className="w-full space-y-6">
      {/* 1. FIRST ITEM: Mandatory Local Weather Banner */}
      <WeatherBanner />

      {/* 2. AdSense Sidebar Slot (300x250) */}
      <AdSenseBanner slotType="sidebar" />

      {/* 3. Mandatory Vertical Editorial Menu with all 50 Categories */}
      <div className="bg-slate-900/90 border border-blue-900/50 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-blue-900/40 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
            <FolderTree className="w-3.5 h-3.5 text-blue-400" />
            <span>Editorias (50 Categorias)</span>
          </div>
          <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded font-mono">
            {categories.length}
          </span>
        </div>

        {/* Quick Filter inside Sidebar */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar editorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-md pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Vertical List of Categories */}
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          <button
            onClick={() => onSelectCategory("Todas")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
              selectedCategory === "Todas"
                ? "bg-blue-600 text-white font-semibold"
                : "text-slate-300 hover:bg-blue-950/80 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-blue-400" />
              <span>Todas as Editorias</span>
            </span>
            <span className="text-[10px] opacity-75 font-mono">Todos</span>
          </button>

          {filteredCategories.map((cat, idx) => {
            const isActive = selectedCategory.toLowerCase() === cat.category.toLowerCase();
            return (
              <button
                key={`cat-side-${cat.category}-${idx}`}
                onClick={() => onSelectCategory(cat.category)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-slate-300 hover:bg-blue-950/80 hover:text-white"
                }`}
              >
                <span className="truncate pr-2">{cat.category}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? "bg-blue-800 text-blue-100" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
