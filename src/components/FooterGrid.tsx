import React from "react";
import { NewsItem } from "../types";
import { extractThumbnail } from "../utils/imageFallback";
import { formatRelativeTime } from "../utils/date";
import { Newspaper, Clock, ArrowRight, RefreshCw, Layers, CheckCircle2 } from "lucide-react";

interface FooterGridProps {
  news: NewsItem[];
  featuredCategory?: string;
  isFilteredByCategory?: boolean;
  onSelectNews: (item: NewsItem) => void;
  onSelectCategory?: (category: string) => void;
  onRotateCategory?: () => void;
}

export const FooterGrid: React.FC<FooterGridProps> = ({
  news,
  featuredCategory,
  isFilteredByCategory = false,
  onSelectNews,
  onSelectCategory,
  onRotateCategory,
}) => {
  // Up to 8 items for a 2-line x 4-column layout
  const items = news.slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section
      id="pre-footer-grid"
      aria-label="Radar Editorial - Destaques da Redação"
      className="w-full bg-slate-950/95 border-t border-blue-900/60 py-10 px-4 mt-16"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-blue-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-900/60 border border-blue-700/50 text-blue-300 shrink-0 shadow-md">
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
                  Radar Editorial • Destaques da Redação
                </h3>
                {featuredCategory && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/80 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60 font-sans shadow-sm">
                    {isFilteredByCategory ? `Editoria: ${featuredCategory}` : `Foco: ${featuredCategory}`}
                  </span>
                )}
              </div>
              {isFilteredByCategory && (
                <p className="text-xs text-blue-800 dark:text-blue-300/80 mt-1">
                  Exibindo exclusivamente as notícias mais recentes da editoria "{featuredCategory}" ({items.length} matérias)
                </p>
              )}
            </div>
          </div>

          {/* Action / State Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isFilteredByCategory ? (
              <button
                onClick={() => onSelectCategory?.("Todas")}
                className="text-xs font-semibold text-blue-900 dark:text-blue-200 hover:text-blue-700 dark:hover:text-white bg-blue-100 dark:bg-blue-950/90 hover:bg-blue-200 dark:hover:bg-blue-900 px-3 py-1.5 rounded-full border border-blue-300 dark:border-blue-700/60 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Voltar para todas as editorias com rotação contínua"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Ver Todas as Editorias</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {onRotateCategory && (
                  <button
                    id="rotate-category-btn"
                    onClick={onRotateCategory}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950 border border-slate-300 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Atualizar editorias em rotação"
                    aria-label="Atualizar editorias"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Atualizar Editorias</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2 Lines x 4 Columns Grid (8 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {items.map((item, idx) => {
            const thumbnail = extractThumbnail(item);
            return (
              <article
                key={item.id ? `footer-grid-${item.id}-${idx}` : `footer-grid-${idx}`}
                onClick={() => onSelectNews(item)}
                className="group cursor-pointer bg-slate-900/80 hover:bg-slate-900 border border-blue-900/30 hover:border-blue-600/70 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 select-none"
              >
                {/* Thumbnail Image */}
                <div className="w-full h-32 relative bg-slate-950 overflow-hidden">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Sem Imagem</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />

                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.category) onSelectCategory?.(item.category);
                    }}
                    className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer"
                    title={`Filtrar somente notícias de ${item.category}`}
                  >
                    {item.category || "Geral"}
                  </span>
                </div>

                {/* Title & Date */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <h4 className="font-serif text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h4>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-blue-300">
                      <Clock className="w-3 h-3 text-blue-400" />
                      {formatRelativeTime(item.pubDate)}
                    </span>
                    <span className="font-semibold text-blue-400 flex items-center gap-0.5 group-hover:underline">
                      Ler <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

