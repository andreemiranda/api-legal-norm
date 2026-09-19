import React, { useState, useMemo, useEffect, useRef } from "react";
import { NewsItem } from "../types";
import {
  extractPostImages,
  processPostContent,
  getProxyImageUrl,
  normalizeImageUrl,
  areImagesEquivalent,
} from "../utils/imageOptimizer";
import { formatDatePtBR, calculateReadingTime, stripHtml } from "../utils/date";
import { AdSenseBanner } from "../components/AdSenseBanner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Copy,
  Check,
  Printer,
  MessageCircle,
  Twitter,
  Send,
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
  const headlineRef = useRef<HTMLDivElement>(null);

  // Extract all images and determine candidate chain
  const { candidates, otherImages } = useMemo(() => {
    return extractPostImages(post);
  }, [post]);
  const [candidateIdx, setCandidateIdx] = useState(0);

  // Reset candidate index on post change
  useEffect(() => {
    setCandidateIdx(0);
  }, [post.id, post.slug]);

  const currentFeaturedImage = candidates[candidateIdx] || candidates[0];

  const handleFeaturedImageError = () => {
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx((prev) => prev + 1);
    }
  };

  // Clean and optimize post content: deduplicates featured image and cleans editorial boilerplate
  // STRICT: Automatically removes the featured hero image if it appears inside the body HTML
  const sanitizedContent = useMemo(() => {
    if (!post.content) return "";
    return processPostContent(post.content, currentFeaturedImage, post);
  }, [post.content, currentFeaturedImage, post]);

  // Additional non-repeated distinct images from the article
  // STRICT RULE: Only keeps images that are NOT the featured image AND NOT already inside the body content!
  const additionalGalleryImages = useMemo(() => {
    if (!otherImages || otherImages.length === 0) return [];

    // Collect all images already shown on the page (top banner + any body photos)
    const alreadyShown: string[] = [];
    if (currentFeaturedImage) alreadyShown.push(currentFeaturedImage);

    // Extract all image sources present in the sanitized body
    const bodyMatches = [
      ...sanitizedContent.matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi),
    ];
    for (const m of bodyMatches) {
      if (m[1]) alreadyShown.push(m[1]);
    }

    const uniqueGallery: string[] = [];
    for (const img of otherImages) {
      if (!img) continue;
      const isAlreadyOnPage = alreadyShown.some((shown) => areImagesEquivalent(img, shown));
      const isInGallery = uniqueGallery.some((g) => areImagesEquivalent(img, g));

      if (!isAlreadyOnPage && !isInGallery) {
        uniqueGallery.push(img);
        alreadyShown.push(img);
      }
    }

    return uniqueGallery;
  }, [otherImages, currentFeaturedImage, sanitizedContent]);

  const readingTime = calculateReadingTime(post.content || post.description);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Scroll to center the visible area on the image/headline when opened
  useEffect(() => {
    if (headlineRef.current) {
      headlineRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 180, behavior: "smooth" });
    }
  }, [post.id, post.slug]);

  const cleanTitle = useMemo(() => {
    return (post.title || "")
      .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
      .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
      .trim();
  }, [post.title]);

  const cleanDescription = useMemo(() => {
    return (post.description || "")
      .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
      .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
      .trim();
  }, [post.description]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`*${cleanTitle}*\n\nLeia no portal Norma Jurídica: ${currentUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(cleanTitle);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${text}`, "_blank");
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(cleanTitle);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(currentUrl)}`, "_blank");
  };

  return (
    <article id="post-detail-page" className="max-w-4xl mx-auto space-y-6 pt-2">
      {/* Target anchor for smooth centering */}
      <div ref={headlineRef} className="scroll-mt-6" />

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

      {/* Header Metadata & Headline */}
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
          {cleanTitle}
        </h1>

        {/* Byline and Share Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <div className="w-8 h-8 rounded-full bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-blue-300 font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Norma Jurídica</p>
              <p className="text-[11px] text-slate-400">
                {post.sourceSite ? `Editoria: ${post.category}` : "Jornalismo Jurídico Especializado"}
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

      {/* Featured Image - Guaranteed and centered */}
      {currentFeaturedImage && (
        <div className="w-full rounded-2xl overflow-hidden border border-blue-900/40 bg-slate-950 relative shadow-2xl">
          <img
            src={currentFeaturedImage}
            alt={cleanTitle}
            referrerPolicy="no-referrer"
            onError={handleFeaturedImageError}
            className="w-full h-[320px] sm:h-[440px] object-cover object-center"
          />
          <div className="p-2.5 bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900">
            <span>{post.category || "Notícia"} • Norma Jurídica</span>
            <span>Edição Nacional</span>
          </div>
        </div>
      )}

      {/* Post Content Body */}
      <div className="bg-slate-900/90 border border-blue-900/30 rounded-2xl p-6 sm:p-8 space-y-6 text-slate-200 leading-relaxed font-sans text-base">
        {sanitizedContent ? (
          <div
            className="prose prose-invert prose-blue max-w-none text-justify space-y-4 [&>p]:text-justify [&>p]:leading-relaxed [&>p]:text-slate-200 [&>p]:text-base [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-white [&>h3]:text-lg [&>h3]:font-semibold [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>a]:text-blue-400 [&>a]:underline [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-6 [&_img]:mx-auto [&_figure]:my-6"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        ) : (
          <p className="text-slate-200 text-base leading-relaxed text-justify">
            {stripHtml(cleanDescription)}
          </p>
        )}

        {/* Additional Distinct Images from Article (Guaranteed non-repeated) */}
        {additionalGalleryImages.length > 0 && (
          <div className="pt-6 border-t border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Fotos da Matéria
            </h3>
            <div className={`grid gap-4 ${additionalGalleryImages.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {additionalGalleryImages.map((imgUrl, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-blue-900/30 bg-slate-950 shadow-md">
                  <img
                    src={imgUrl}
                    alt={`${cleanTitle} - Imagem ${i + 2}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-56 sm:h-64 object-cover object-center hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-2 bg-slate-950 text-[11px] text-slate-400">
                    Norma Jurídica • Registro visual {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-Article AdSense Banner Slot */}
        <div className="my-8">
          <AdSenseBanner slotType="in-article" />
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
              const rImages = extractPostImages(r);
              const rThumb = rImages.featuredImage;
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
                      onError={(e) => {
                        const fallback = rImages.candidates[1] || rImages.candidates[rImages.candidates.length - 1];
                        if (fallback) {
                          (e.currentTarget as HTMLImageElement).src = fallback;
                        }
                      }}
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
