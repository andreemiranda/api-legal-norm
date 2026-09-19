import React, { useState, useEffect } from "react";
import { NewsItem } from "../types";
import { extractThumbnail } from "../utils/imageFallback";
import { formatRelativeTime, stripHtml, calculateReadingTime } from "../utils/date";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface NewsCarouselProps {
  news: NewsItem[];
  onSelectNews: (item: NewsItem) => void;
  onSelectCategory?: (category: string) => void;
}

export const NewsCarousel: React.FC<NewsCarouselProps> = ({ news, onSelectNews, onSelectCategory }) => {
  // Up to 6 items
  const items = news.slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const DURATION_MS = 6000; // 6 seconds per item

  // Next slide
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % (items.length || 1));
  };

  // Prev slide
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + (items.length || 1)) % (items.length || 1));
  };

  // 6-second timer loop for automatic rotation
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, DURATION_MS);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, items.length]);

  if (items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];
  const thumbnail = extractThumbnail(currentItem);
  const excerpt = stripHtml(currentItem.description || currentItem.content || "").slice(0, 180);

  return (
    <div
      id="news-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-blue-900/60 shadow-2xl group select-none"
    >
      {/* Visual Background with subtle zoom and vibrant natural brightness */}
      <div className="relative h-[360px] sm:h-[420px] md:h-[460px] w-full overflow-hidden bg-slate-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={currentItem.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center transform transition-transform duration-1000 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-900">
            <span className="text-xl uppercase font-bold tracking-wider text-slate-700">Sem Imagem</span>
          </div>
        )}

        {/* Camada suave apenas no rodapé inferior para preservar a luminosidade e nitidez total da imagem */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent pointer-events-none" />

        {/* Lateral Navigation Arrows centered vertically */}
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              aria-label="Matéria anterior"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-950/70 hover:bg-blue-600 text-white border border-white/20 flex items-center justify-center transition-all shadow-xl backdrop-blur-sm z-20 focus:outline-none"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              aria-label="Próxima matéria"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-950/70 hover:bg-blue-600 text-white border border-white/20 flex items-center justify-center transition-all shadow-xl backdrop-blur-sm z-20 focus:outline-none"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Content Box: apenas Categoria, data, tempo de leitura, Título e pequeno texto abaixo do título */}
        <div
          onClick={() => onSelectNews(currentItem)}
          className="absolute inset-0 p-6 sm:p-10 md:p-12 flex flex-col justify-end max-w-3xl z-10 cursor-pointer"
        >
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (currentItem.category) onSelectCategory?.(currentItem.category);
              }}
              className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer transition-colors"
              title={`Filtrar somente notícias da editoria ${currentItem.category}`}
            >
              {currentItem.category || "Em Destaque"}
            </span>

            <span className="flex items-center gap-1 text-xs text-blue-200 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-md border border-blue-900/40">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              {formatRelativeTime(currentItem.pubDate)}
            </span>

            <span className="text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
              Leitura: {calculateReadingTime(currentItem.content || currentItem.description)} min
            </span>
          </div>

          {/* Título */}
          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-white hover:text-blue-300 transition-colors line-clamp-3 leading-snug drop-shadow-md mb-2">
            {currentItem.title}
          </h2>

          {/* Pequeno texto abaixo do título */}
          {excerpt && (
            <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed drop-shadow">
              {excerpt}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
