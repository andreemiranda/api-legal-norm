import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface WordPressPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export const WordPressPagination: React.FC<WordPressPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  // Build page numbers array with ellipses similar to WordPress paginate_links()
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    // Always include page 1
    pages.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("...");
    }

    // Always include last page
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(totalItems, currentPage * perPage);

  return (
    <nav
      id="wordpress-pagination"
      aria-label="Paginação estilo WordPress"
      className="my-8 pt-6 border-t border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 select-none"
    >
      {/* WordPress Results Legend */}
      <div className="text-xs text-slate-400">
        Mostrando <span className="text-blue-300 font-semibold">{startItem}–{endItem}</span> de{" "}
        <span className="text-blue-300 font-semibold">{totalItems}</span> notícias • Página{" "}
        <span className="text-blue-300 font-semibold">{currentPage}</span> de{" "}
        <span className="text-blue-300 font-semibold">{totalPages}</span>
      </div>

      {/* WordPress-style Pagination Links */}
      <div className="flex items-center gap-1">
        {/* First Page button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Primeira página"
          className="p-2 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:bg-blue-900/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous page « Anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-blue-900/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>« Anterior</span>
        </button>

        {/* Number buttons & dots */}
        <div className="flex items-center gap-1 px-1">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`dot-${idx}`} className="px-2 text-slate-500 text-xs">
                  …
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}-${idx}`}
                onClick={() => onPageChange(pageNum)}
                aria-current={isActive ? "page" : undefined}
                className={`w-8 h-8 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md border border-blue-400 font-bold"
                    : "bg-slate-900/80 text-slate-300 hover:bg-blue-950 hover:text-white border border-slate-800"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next page Próximo » */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-blue-900/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
        >
          <span>Próximo »</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Última página"
          className="p-2 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:bg-blue-900/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};
