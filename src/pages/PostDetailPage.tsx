import React, { useState, useMemo } from "react";
import { NewsItem } from "../types";
import { extractThumbnail } from "../utils/imageFallback";
import { formatDatePtBR, calculateReadingTime, stripHtml } from "../utils/date";
import { AdSenseBanner } from "../components/AdSenseBanner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Bookmark,
  Printer,
  Scale,
  MessageCircle,
  Twitter,
  Linkedin,
  Send
} from "lucide-react";

interface PostDetailPageProps {
  post: NewsItem;
  relatedPosts: NewsItem[];
  onBack: () => void;
  onSelectPost: (post: NewsItem) => void;
  onSelectCategory: (category: string) => void;
}

export const PostDetailPage: React.FC<PostDetailPageProps> = ({
  post,
  relatedPosts,
  onBack,
  onSelectPost,
  onSelectCategory,
}) => {
  const [copied, setCopied] = useState(false);
  const thumbnail = extractThumbnail(post);
  const readingTime = calculateReadingTime(post.content || post.description);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Strip embedded <img> and <figure> tags from post.content to ensure only one single featured image is displayed per post
  const sanitizedContent = useMemo(() => {
    if (!post.content) return "";
    return post.content
      .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
      .replace(/<img[^>]*>/gi, "")
      .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
      .trim();
  }, [post.content]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`*${post.title}*\n\nLeia no portal Norma Jurídica: ${currentUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(post.title);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${text}`, "_blank");
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(post.title);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(currentUrl)}`, "_blank");
  };

  return (
    <article id="post-detail-page" className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumbs & Return */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao feed de notícias</span>
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span>Início</span>
          <span>/</span>
          <button
            onClick={() => onSelectCategory(post.category)}
            className="text-blue-300 hover:underline"
          >
            {post.category}
          </button>
          <span>/</span>
          <span className="text-slate-500 truncate max-w-[200px]">Matéria</span>
        </div>
      </div>

      {/* Header Metadata */}
      <div>
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <button
            onClick={() => onSelectCategory(post.category)}
            className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors"
          >
            {post.category || "Legislação & Notícias"}
          </button>

          <span className="flex items-center gap-1 text-xs text-blue-200 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            {formatDatePtBR(post.pubDate)}
          </span>

          <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            {readingTime} min de leitura estimada
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
          {post.title}
        </h1>

        {/* Byline and Share Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <div className="w-8 h-8 rounded-full bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-blue-300 font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Redação Norma Jurídica</p>
              <p className="text-[11px] text-slate-400">
                {post.sourceSite ? `Fonte: ${post.sourceSite}` : "Jornalismo Jurídico Especializado"}
              </p>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1 hidden sm:inline">Compartilhar:</span>

            <button
              onClick={handleShareWhatsApp}
              title="Compartilhar no WhatsApp"
              className="p-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            <button
              onClick={handleShareTelegram}
              title="Compartilhar no Telegram"
              className="p-2 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-400 border border-sky-800/50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>

            <button
              onClick={handleShareTwitter}
              title="Compartilhar no X (Twitter)"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Twitter className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyLink}
              title="Copiar link da matéria"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => window.print()}
              title="Imprimir matéria"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      <div className="w-full rounded-2xl overflow-hidden border border-blue-900/40 bg-slate-950 relative shadow-2xl">
        <img
          src={thumbnail}
          alt={post.title}
          referrerPolicy="no-referrer"
          className="w-full h-[320px] sm:h-[420px] object-cover object-center"
        />
        <div className="p-2.5 bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900">
          <span>Registro fotográfico editorial • Arquivo institucional</span>
          <span>Foto ilustrativa • Norma Jurídica</span>
        </div>
      </div>

      {/* Post Content Body */}
      <div className="bg-slate-900/90 border border-blue-900/30 rounded-2xl p-6 sm:p-8 space-y-6 text-slate-200 leading-relaxed font-sans text-base">
        {sanitizedContent ? (
          <div
            className="prose prose-invert prose-blue max-w-none text-justify space-y-4 [&>p]:text-justify [&>p]:leading-relaxed [&>p]:text-slate-200 [&>p]:text-base [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-white [&>h3]:text-lg [&>h3]:font-semibold [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>a]:text-blue-400 [&>a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        ) : (
          <p className="text-slate-200 text-base leading-relaxed text-justify">
            {stripHtml(post.description)}
          </p>
        )}

        {/* In-Article AdSense Banner Slot */}
        <div className="my-8">
          <AdSenseBanner slotType="in-article" />
        </div>

        {/* Original link attribution if available */}
        {post.link && (
          <div className="mt-8 p-4 rounded-xl bg-slate-950 border border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-slate-200">Publicação e Fonte Original</p>
              <p className="text-slate-400 text-[11px] truncate max-w-md mt-0.5">
                {post.link}
              </p>
            </div>

            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 hover:text-white flex items-center gap-1.5 font-medium transition-colors"
            >
              <span>Acessar fonte original</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Legal Disclaimer */}
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-900/40 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-semibold text-blue-300 mb-1">
            <Scale className="w-4 h-4" />
            <span>Aviso de Responsabilidade Editorial</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed text-justify">
            As informações contidas neste portal possuem finalidade estritamente jornalística e informativa. Não constituem consultoria jurídica formal. Pedidos de retificação ou dúvidas podem ser submetidos através de nossa Ouvidoria e canais de atendimento.
          </p>
        </div>
      </div>

      {/* Related Posts Section */}
      {relatedPosts.length > 0 && (
        <div className="pt-6 border-t border-blue-900/40">
          <h3 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>Mais Notícias em {post.category || "Destaque"}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPosts.slice(0, 3).map((r, idx) => {
              const rThumb = extractThumbnail(r);
              return (
                <div
                  key={r.id ? `related-${r.id}-${idx}` : `related-${idx}`}
                  onClick={() => onSelectPost(r)}
                  className="group cursor-pointer bg-slate-900 border border-slate-800 hover:border-blue-700/60 rounded-xl overflow-hidden transition-all shadow-sm"
                >
                  <div className="w-full h-28 overflow-hidden bg-slate-950">
                    <img
                      src={rThumb}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] text-blue-400 font-semibold uppercase">{r.category}</span>
                    <h4 className="font-serif text-xs font-bold text-white group-hover:text-blue-300 line-clamp-2 mt-1">
                      {r.title}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
};
