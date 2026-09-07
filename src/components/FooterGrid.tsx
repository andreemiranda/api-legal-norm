import React from "react";
import { NewsItem } from "../types";
import { extractThumbnail } from "../utils/imageFallback";
import { formatRelativeTime } from "../utils/date";
import { Newspaper, Clock, ArrowRight } from "lucide-react";

interface FooterGridProps {
  news: NewsItem[];
  onSelectNews: (item: NewsItem) => void;
}

export const FooterGrid: React.FC<FooterGridProps> = ({ news, onSelectNews }) => {
  // Exactly 8 items for a 2-line x 4-column layout as requested
  const items = news.slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section
      id="pre-footer-grid"
      aria-label="Notícias em Destaque no Portal"
      className="w-full bg-slate-950/90 border-t border-blue-900/60 py-10 px-4 mt-16"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-blue-900/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-900/60 border border-blue-700/50">
              <Newspaper className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                Radar Editorial • Destaques da Redação
              </h3>
              <p className="text-xs text-blue-300/70">
                Seleção das principais coberturas jornalísticas e jurídicas em 8 matérias
              </p>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-blue-300 font-semibold uppercase tracking-wider bg-blue-950 px-3 py-1 rounded-full border border-blue-800/60">
            <span>Destaques</span>
          </span>
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
                  <img
                    src={thumbnail}
                    alt={item.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-sm">
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
