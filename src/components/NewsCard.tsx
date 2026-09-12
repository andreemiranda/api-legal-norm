import React, { useMemo } from "react";
import { NewsItem } from "../types";
import { extractPostImages, getProxyImageUrl } from "../utils/imageOptimizer";
import { formatRelativeTime, stripHtml, calculateReadingTime } from "../utils/date";
import { Clock, ArrowUpRight } from "lucide-react";

interface NewsCardProps {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  layout?: "vertical" | "horizontal";
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onSelect, layout = "vertical" }) => {
  const { featuredImage } = useMemo(() => extractPostImages(item), [item]);
  const proxySrc = useMemo(() => getProxyImageUrl(featuredImage), [featuredImage]);

  const cleanTitle = useMemo(() => {
    return (item.title || "")
      .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
      .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
      .trim();
  }, [item.title]);

  const cleanExcerpt = useMemo(() => {
    const raw = stripHtml(item.description || item.content || "")
      .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
      .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
      .trim();
    return raw.slice(0, 140);
  }, [item.description, item.content]);

  const readingTime = calculateReadingTime(item.content || item.description);

  if (layout === "horizontal") {
    return (
      <article
        onClick={() => onSelect(item)}
        className="group cursor-pointer bg-slate-900/70 hover:bg-slate-900 border border-blue-900/30 hover:border-blue-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row gap-4 transition-all duration-200 shadow-sm hover:shadow-md select-none"
      >
        {/* Thumbnail - Guaranteed image */}
        <div className="w-full sm:w-44 h-36 sm:h-32 rounded-lg overflow-hidden shrink-0 relative bg-slate-950">
          <img
            src={proxySrc}
            alt={cleanTitle}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.jpg";
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600/90 text-white backdrop-blur">
            {item.category || "Geral"}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1.5">
              <span className="flex items-center gap-1 text-blue-300">
                <Clock className="w-3 h-3 text-blue-400" />
                {formatRelativeTime(item.pubDate)}
              </span>
              <span>•</span>
              <span>{readingTime} min de leitura</span>
            </div>

            <h3 className="font-serif text-base font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
              {cleanTitle}
            </h3>

            {cleanExcerpt && (
              <p className="text-xs text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">
                {cleanExcerpt}...
              </p>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-blue-400">
            <span className="font-semibold flex items-center gap-1 group-hover:underline">
              Ler notícia completa
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => onSelect(item)}
      className="group cursor-pointer bg-slate-900/70 hover:bg-slate-900 border border-blue-900/30 hover:border-blue-700/60 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md select-none"
    >
      {/* Thumbnail - Guaranteed image */}
      <div className="w-full h-44 relative bg-slate-950 overflow-hidden">
        <img
          src={proxySrc}
          alt={cleanTitle}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo.jpg";
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />

        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow">
          {item.category || "Geral"}
        </span>

        <span className="absolute bottom-2 left-2.5 flex items-center gap-1 text-[11px] text-blue-200 bg-slate-950/70 backdrop-blur px-2 py-0.5 rounded">
          <Clock className="w-3 h-3 text-blue-400" />
          {formatRelativeTime(item.pubDate)}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1.5">
            <span>{readingTime} min de leitura</span>
          </div>

          <h3 className="font-serif text-base font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
            {cleanTitle}
          </h3>

          {cleanExcerpt && (
            <p className="text-xs text-slate-300 line-clamp-2 mt-2 leading-relaxed">
              {cleanExcerpt}...
            </p>
          )}
        </div>

        <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-400">
          <span className="font-semibold flex items-center gap-1 group-hover:underline">
            Acessar matéria
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </article>
  );
};
