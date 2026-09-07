import React, { useState } from "react";
import { NewsSource } from "../types";
import { X, Search, ExternalLink, Globe, Layers, Filter, CheckCircle2 } from "lucide-react";

interface SourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NewsSource[];
  onFilterBySource: (source: NewsSource) => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({
  isOpen,
  onClose,
  sources,
  onFilterBySource,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Todas");

  if (!isOpen) return null;

  const categories = Array.from(new Set(sources.map((s) => s.category))).sort();

  const filteredSources = sources.filter((s) => {
    const matchesSearch =
      s.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.id).includes(searchTerm);
    const matchesCategory =
      selectedCategoryFilter === "Todas" || s.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-slate-900 border border-blue-800/80 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-blue-900/40 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-900/60 border border-blue-700/50">
              <Layers className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                Fontes e Veículos Integrados
              </h3>
              <p className="text-xs text-blue-300/70">
                Mapeamento das fontes e agências jornalísticas conectadas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por site, categoria ou ID do endpoint..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400 shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Todas">Todas as Categorias ({sources.length})</option>
              {categories.map((c, idx) => (
                <option key={`src-cat-${c}-${idx}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sources Grid */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
            <span>
              Mostrando <strong className="text-blue-300">{filteredSources.length}</strong> fontes integradas
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fontes ativas e sincronizadas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSources.map((s, idx) => (
              <div
                key={`source-${s.id}-${idx}`}
                className="bg-slate-950/70 border border-slate-800 hover:border-blue-700/60 rounded-xl p-3.5 flex flex-col justify-between transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/60">
                      {s.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {s.id}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{s.site}</span>
                  </h4>

                  <p className="text-[11px] text-slate-400 truncate font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800/60 mt-1">
                    {s.url}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <a
                    href={`https://${s.site}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <span>Visitar portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => {
                      onFilterBySource(s);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Ver Notícias desta Fonte
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Sincronização em tempo real com <code className="text-blue-300 font-mono">api-news-media.netlify.app</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
