import React, { useState } from "react";
import { NewsSource } from "../types";
import { X, Search, ExternalLink, Globe, Layers, Filter, CheckCircle2, Copy, Check, Image as ImageIcon } from "lucide-react";
import { NEWS_MEDIA_ENDPOINTS } from "../services/newsApiConfig";

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
  const [activeTab, setActiveTab] = useState<"news" | "media">("news");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Todas");
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  if (!isOpen) return null;

  const handleCopyEndpoint = (id: number | string, endpointUrl: string) => {
    navigator.clipboard?.writeText(endpointUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = Array.from(new Set(sources.map((s) => s.category))).sort();

  const filteredSources = sources.filter((s) => {
    const endpointUrl = `https://api-news-media.netlify.app/api/news/${s.id}`;
    const matchesSearch =
      "https://api-news-media.netlify.app".includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.id).includes(searchTerm) ||
      endpointUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.originalSite && s.originalSite.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory =
      selectedCategoryFilter === "Todas" || s.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredMedia = NEWS_MEDIA_ENDPOINTS.filter((m) => {
    const matchesSearch =
      String(m.id).includes(searchTerm) ||
      m.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.site.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div
      id="sources-modal"
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
                Fontes e Endpoints Integrados
              </h3>
              <p className="text-xs text-blue-300/70">
                Rotas de API ativas e catalogadas via <span className="font-mono text-blue-200">https://api-news-media.netlify.app</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("news")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "news"
                ? "text-blue-300 border-blue-500 bg-slate-900"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Fontes de Notícias ({sources.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "media"
                ? "text-emerald-300 border-emerald-500 bg-slate-900"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Canais de Mídia e Imagens ({NEWS_MEDIA_ENDPOINTS.length}) [IDs Sincronizados]</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "news"
                  ? "Buscar por ID, categoria ou endpoint de notícias..."
                  : "Buscar por ID sincronizado ou endpoint de imagens..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {activeTab === "news" && (
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
          )}
        </div>

        {/* Sources or Media Grid */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === "news" ? (
            <>
              <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
                <span>
                  Mostrando <strong className="text-blue-300">{filteredSources.length}</strong> endpoints de notícias
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Endpoints de notícias ativos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSources.map((s, idx) => {
                  const endpointUrl = `https://api-news-media.netlify.app/api/news/${s.id}`;
                  const isCopied = copiedId === s.id;

                  return (
                    <div
                      key={`source-${s.id}-${idx}`}
                      className="bg-slate-950/70 border border-slate-800 hover:border-blue-700/60 rounded-xl p-3.5 flex flex-col justify-between transition-colors shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/60">
                            {s.category}
                          </span>
                          <span className="text-[10px] text-blue-300/80 font-mono bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/50">
                            ID: {s.id}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate font-mono text-xs text-blue-200">
                            https://api-news-media.netlify.app
                          </span>
                        </h4>

                        {/* API Endpoint Utilized */}
                        <div className="relative mt-1 group">
                          <p className="text-[11px] text-emerald-400/90 truncate font-mono bg-slate-900/90 pl-2 pr-8 py-1.5 rounded border border-slate-800/80 select-all" title={endpointUrl}>
                            {endpointUrl}
                          </p>
                          <button
                            onClick={() => handleCopyEndpoint(s.id, endpointUrl)}
                            className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                            title="Copiar URL da API"
                            aria-label="Copiar URL da API"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 hover:text-blue-300" />
                            )}
                          </button>
                        </div>

                        {s.originalSite && (
                          <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                            Feed vinculado: <span className="text-slate-400 font-mono">{s.originalSite}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <a
                          href={endpointUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
                          title="Abrir endpoint da API"
                        >
                          <span>Acessar Endpoint API</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          onClick={() => {
                            onFilterBySource(s);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          Ver Notícias da Fonte
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
                <span>
                  Mostrando <strong className="text-emerald-300">{filteredMedia.length}</strong> canais de imagens (sincronizados com notícias)
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 27 canais mapeados com IDs idênticos às notícias
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMedia.map((m) => {
                  const endpointUrl = m.site;
                  const isCopied = copiedId === m.id;
                  const matchingSource = sources.find((s) => s.id === m.id);

                  return (
                    <div
                      key={`media-ch-${m.id}-${m.index}`}
                      className="bg-slate-950/70 border border-slate-800 hover:border-emerald-700/60 rounded-xl p-3.5 flex flex-col justify-between transition-colors shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            Canal de Mídia #{m.index}
                          </span>
                          <span className="text-[10px] text-emerald-300/80 font-mono bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/50">
                            ID: {m.id}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate font-mono text-xs text-emerald-200">
                            {m.endpoint}
                          </span>
                        </h4>

                        {matchingSource && (
                          <p className="text-[11px] text-slate-400 mb-1.5">
                            Sincronizado com Fonte #{m.index}: <strong className="text-blue-300">{matchingSource.category}</strong> ({matchingSource.originalSite || "Fonte"})
                          </p>
                        )}

                        {/* API Endpoint Utilized */}
                        <div className="relative mt-1 group">
                          <p className="text-[11px] text-emerald-400/90 truncate font-mono bg-slate-900/90 pl-2 pr-8 py-1.5 rounded border border-slate-800/80 select-all" title={endpointUrl}>
                            {endpointUrl}
                          </p>
                          <button
                            onClick={() => handleCopyEndpoint(m.id, endpointUrl)}
                            className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                            title="Copiar URL do Endpoint de Imagens"
                            aria-label="Copiar URL do Endpoint de Imagens"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 hover:text-emerald-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <a
                          href={endpointUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                          title="Abrir endpoint de imagens da API"
                        >
                          <span>Acessar Endpoint Imagens</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {matchingSource && (
                          <button
                            onClick={() => {
                              onFilterBySource(matchingSource);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Ver Notícias Desta Fonte
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>
            API News Media: <code className="text-blue-300 font-mono">https://api-news-media.netlify.app</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
