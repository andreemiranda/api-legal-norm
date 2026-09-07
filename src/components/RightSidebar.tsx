import React, { useState } from "react";
import { CategoryItem, NewsItem } from "../types";
import { WeatherBanner } from "./WeatherBanner";
import { AdSenseBanner } from "./AdSenseBanner";
import {
  FolderTree,
  Search,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { extractThumbnail } from "../utils/imageFallback";

interface RightSidebarProps {
  categories: CategoryItem[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenSourcesModal?: () => void;
  totalSourcesCount?: number;
  recentNews?: NewsItem[];
  onSelectNews?: (item: NewsItem) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  recentNews = [],
  onSelectNews,
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
            <span>Editorias</span>
          </div>
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
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Recent News / Destaques */}
      {recentNews.length > 0 && (
        <div className="bg-slate-900/90 border border-blue-900/50 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-300 border-b border-blue-900/40 pb-2.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span>Últimas Notícias</span>
          </div>
          <div className="space-y-4">
            {recentNews.slice(0, 5).map((item, idx) => {
              const thumbnail = extractThumbnail(item);
              return (
                <article
                  key={`recent-${item.id || idx}`}
                  onClick={() => onSelectNews?.(item)}
                  className="group flex gap-3 cursor-pointer items-start"
                >
                  <div className="w-16 h-16 shrink-0 rounded bg-slate-950 overflow-hidden border border-slate-800">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                        <span className="text-[8px] uppercase font-bold tracking-wider text-slate-600">Sem Foto</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-blue-400 line-clamp-3 leading-snug transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[9px] font-semibold uppercase text-blue-500 mt-1 block">
                      {item.category}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Bottom AdSense Sidebar Slot (300x250) */}
      <AdSenseBanner slotType="sidebar-bottom" />
    </aside>
  );
};
