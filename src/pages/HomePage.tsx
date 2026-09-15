import React, { useState } from "react";
import { NewsItem } from "../types";
import { NewsCarousel } from "../components/NewsCarousel";
import { NewsCard } from "../components/NewsCard";
import { WordPressPagination } from "../components/WordPressPagination";
import {
  Clock,
  Sparkles,
  LayoutGrid,
  List,
  Filter,
  Layers,
  ArrowUpDown,
  Search,
  RefreshCw,
  Tag,
  Hash
} from "lucide-react";

interface HomePageProps {
  news: NewsItem[];
  allNewsCount: number;
  carouselNews: NewsItem[];
  carouselCategory?: string;
  isCarouselFiltered?: boolean;
  onRotateCarousel?: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSelectNews: (item: NewsItem) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  perPage: number;
  searchTerm: string;
  onClearSearch: () => void;
  selectedSourceId?: number;
  onClearSourceFilter: () => void;
  isLoading: boolean;
  categoryTags?: Array<{ name: string; count: number }>;
  categoryTagCount?: number;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  news,
  allNewsCount,
  carouselNews,
  carouselCategory,
  isCarouselFiltered,
  onRotateCarousel,
  selectedCategory,
  onSelectCategory,
  onSelectNews,
  currentPage,
  totalPages,
  onPageChange,
  perPage,
  searchTerm,
  onClearSearch,
  selectedSourceId,
  onClearSourceFilter,
  isLoading,
  categoryTags = [],
  categoryTagCount = 0,
  selectedTag = null,
  onSelectTag,
}) => {
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("list");

  return (
    <div id="home-page" className="space-y-8">
      {/* 1. News Carousel (Only on Page 1 and when no search/source filter active) */}
      {currentPage === 1 && !searchTerm && !selectedSourceId && (
        <section aria-label="Carrossel de Notícias Principais">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
              <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <span>Cobertura em Destaque</span>
                {carouselCategory && (
                  <span className="text-white font-sans text-xs font-semibold">
                    • {isCarouselFiltered ? `Editoria: ${carouselCategory}` : `Foco: ${carouselCategory}`}
                  </span>
                )}
              </h2>
            </div>
            {!isCarouselFiltered && onRotateCarousel && (
              <button
                onClick={onRotateCarousel}
                className="text-[11px] text-blue-300 hover:text-white flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-blue-800/60 hover:bg-blue-950 transition-colors cursor-pointer"
                title="Girar para a próxima editoria em destaque"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Girar Editoria</span>
              </button>
            )}
          </div>
          <NewsCarousel
            news={carouselNews}
            onSelectNews={onSelectNews}
            onSelectCategory={onSelectCategory}
          />
        </section>
      )}

      {/* 2. Chronological Feed Header & Filters */}
      <section aria-label="Notícias Mais Recentes">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-900/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="font-serif text-xl font-bold text-white tracking-wide">
                {selectedCategory === "Todas" ? "Últimas Notícias e Reportagens" : `Editoria: ${selectedCategory}`}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                {allNewsCount} notícias disponíveis
              </span>
              {categoryTagCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                  <Tag className="w-3 h-3 text-blue-400" />
                  {categoryTagCount} tags
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Organizadas das mais recentes primeiro • Mínimo 250 matérias por editoria com indexação temática
            </p>
          </div>

          {/* Controls: View toggle & Active Filter Chips */}
          <div className="flex items-center gap-3">
            {/* Filter pills if active */}
            {selectedTag && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm">
                <Hash className="w-3 h-3" />
                Tag: {selectedTag}
                <button onClick={() => onSelectTag?.(null)} className="hover:text-blue-200 font-bold ml-0.5" title="Remover filtro de tag">✕</button>
              </span>
            )}

            {searchTerm && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-xs">
                Busca: "{searchTerm}"
                <button onClick={onClearSearch} className="hover:text-white font-bold">✕</button>
              </span>
            )}

            {selectedSourceId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-xs">
                Fonte #{selectedSourceId}
                <button onClick={onClearSourceFilter} className="hover:text-white font-bold">✕</button>
              </span>
            )}

            {/* Layout switch */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-slate-400">
              <button
                onClick={() => setLayoutMode("list")}
                title="Visualização em lista"
                className={`p-1.5 rounded ${layoutMode === "list" ? "bg-blue-600 text-white shadow-sm" : "hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayoutMode("grid")}
                title="Visualização em grade"
                className={`p-1.5 rounded ${layoutMode === "grid" ? "bg-blue-600 text-white shadow-sm" : "hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tag Filter Bar */}
        {categoryTags.length > 0 && onSelectTag && (
          <div className="mt-3 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 shrink-0 mr-1">
              <Hash className="w-3 h-3 text-blue-400" />
              Tags:
            </span>
            <button
              onClick={() => onSelectTag(null)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors shrink-0 ${
                !selectedTag
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              Todas ({allNewsCount})
            </button>
            {categoryTags.slice(0, 18).map((t) => {
              const isTagActive = selectedTag?.toLowerCase() === t.name.toLowerCase();
              return (
                <button
                  key={t.name}
                  onClick={() => onSelectTag(isTagActive ? null : t.name)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shrink-0 ${
                    isTagActive
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  <span>{t.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isTagActive ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-400"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <p className="text-xs">Sincronizando notícias da rede...</p>
          </div>
        ) : news.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/50 rounded-2xl border border-slate-800 p-6 my-6">
            <Filter className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-white">Nenhuma notícia encontrada</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Não foram encontradas matérias com os filtros atuais. Tente buscar outros termos ou selecione "Todas as Notícias".
            </p>
            <button
              onClick={() => {
                onSelectCategory("Todas");
                onClearSearch();
                onClearSourceFilter();
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Limpar Filtros e Ver Todas
            </button>
          </div>
        ) : (
          /* News Feed Grid or List */
          <div
            className={`mt-6 ${
              layoutMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 gap-5"
                : "space-y-4"
            }`}
          >
            {news.map((item, idx) => (
              <NewsCard
                key={item.id ? `${item.id}-${idx}` : `news-${idx}`}
                item={item}
                onSelect={onSelectNews}
                layout={layoutMode === "grid" ? "vertical" : "horizontal"}
              />
            ))}
          </div>
        )}

        {/* 3. WordPress Style Pagination Component */}
        <WordPressPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={allNewsCount}
          perPage={perPage}
          onPageChange={onPageChange}
        />
      </section>
    </div>
  );
};
