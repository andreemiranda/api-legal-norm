import React, { useState, useEffect, useRef } from "react";
import { NewsItem } from "../types";
import { extractThumbnail } from "../utils/imageFallback";
import { formatRelativeTime, stripHtml, calculateReadingTime } from "../utils/date";
import { ChevronLeft, ChevronRight, Play, Pause, Clock, ArrowRight, BookOpen } from "lucide-react";

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
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const DURATION_MS = 6000; // 6 seconds per item as requested
  const STEP_MS = 50;

  // Next slide
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % (items.length || 1));
    setProgress(0);
  };

  // Prev slide
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + (items.length || 1)) % (items.length || 1));
    setProgress(0);
  };

  // 6-second timer loop + progress bar
  useEffect(() => {
    if (items.length <= 1 || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    setProgress(0);
    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= DURATION_MS) {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        setProgress(0);
        clearInterval(progressIntervalRef.current!);
      }
    }, STEP_MS);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
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
      {/* Visual Background with subtle zoom */}
      <div className="relative h-[380px] sm:h-[440px] md:h-[480px] w-full overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={currentItem.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center transform transition-transform duration-1000 ease-out group-hover:scale-105 filter brightness-75"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-900 filter brightness-75">
            <span className="text-xl uppercase font-bold tracking-wider text-slate-800">Sem Imagem</span>
          </div>
        )}

        {/* Gradient overlays for readability and dark blue atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-blue-950/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />

        {/* Content Box */}
        <div className="absolute inset-0 p-6 sm:p-8 md:p-10 flex flex-col justify-end max-w-3xl z-10">
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

            {isPaused && (
              <span className="text-[11px] text-amber-300 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                <Pause className="w-2.5 h-2.5" /> Pausado
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            onClick={() => onSelectNews(currentItem)}
            className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-white hover:text-blue-300 transition-colors line-clamp-3 leading-snug cursor-pointer mb-2 drop-shadow-md"
          >
            {currentItem.title}
          </h2>

          {/* Excerpt */}
          {excerpt && (
            <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed mb-4 hidden sm:block">
              {excerpt}...
            </p>
          )}

          {/* Action button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onSelectNews(currentItem)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg hover:shadow-blue-600/30 hover:translate-x-0.5"
            >
              <span>Ler Matéria Completa</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <span className="text-xs text-slate-400 font-mono">
              Item {currentIndex + 1} de {items.length} (Roda a cada 6s)
            </span>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="absolute right-4 bottom-6 sm:bottom-8 flex items-center gap-2 z-20">
          <button
            onClick={prevSlide}
            title="Matéria anterior"
            className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-700 text-slate-200 hover:text-white border border-blue-800/50 flex items-center justify-center transition-all shadow-lg backdrop-blur"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Retomar rotação automática" : "Pausar rotação automática"}
            className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-blue-700 text-slate-300 hover:text-white border border-blue-800/50 flex items-center justify-center transition-all backdrop-blur"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 ml-0.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          <button
            onClick={nextSlide}
            title="Próxima matéria"
            className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-700 text-slate-200 hover:text-white border border-blue-800/50 flex items-center justify-center transition-all shadow-lg backdrop-blur"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Track & Indicator Tabs */}
      <div
        className="grid border-t border-blue-900/40 bg-slate-900/90 text-xs"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` }}
      >
        {items.map((item, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={item.id ? `carousel-${item.id}-${idx}` : `carousel-${idx}`}
              onClick={() => {
                setCurrentIndex(idx);
                setProgress(0);
              }}
              className={`relative px-2 py-2 text-left transition-all border-r last:border-r-0 border-blue-950 flex flex-col justify-between ${
                isActive ? "bg-blue-950/80 text-white" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
              }`}
            >
              {/* Progress Bar filling over 6 seconds for active item */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
                {isActive && (
                  <div
                    className="h-full bg-blue-500 transition-all ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                <span className={`font-bold ${isActive ? "text-blue-400" : "text-slate-500"}`}>
                  0{idx + 1}
                </span>
                <span className="hidden md:inline text-[10px] text-slate-400 truncate max-w-[80px]">
                  {item.category}
                </span>
              </div>

              <p className="text-[11px] font-medium truncate mt-0.5 hidden sm:block">
                {item.title}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
