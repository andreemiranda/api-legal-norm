import { updateClientSEO } from "./utils/seoUtils";
import React, { useState, useEffect, useMemo } from "react";
import { NewsItem, CategoryItem, NewsSource } from "./types";
import { ConsentProvider } from "./context/ConsentContext";
import { Header } from "./components/Header";
import { RightSidebar } from "./components/RightSidebar";
import { Footer } from "./components/Footer";
import { FooterGrid } from "./components/FooterGrid";
import { CookieBanner } from "./components/CookieBanner";
import { SourcesModal } from "./components/SourcesModal";
import { AdminMetricsModal } from "./components/AdminMetricsModal";
import { trafficRouter } from "./services/firebaseTrafficRouter";

import { HomePage } from "./pages/HomePage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsOfUsePage } from "./pages/TermsOfUsePage";
import { CookiePolicyPage } from "./pages/CookiePolicyPage";
import { LgpdPortalPage } from "./pages/LgpdPortalPage";
import { ConsentManagementPage } from "./pages/ConsentManagementPage";
import { ContactPage } from "./pages/ContactPage";

import staticCategories from "./data/categories.json";
import staticSources from "./data/sources.json";
import { searchNews } from "./utils/search";
import { categoryToSlug, matchCategories } from "./utils/slug";
import { buildCategoryFeed } from "./utils/categoryFeedManager";
import {
  sortNewsChronological,
  getRandomSeed,
  getCarouselNews,
  getRadarEditorialNews,
  getSidebarNews,
} from "./utils/editorialRotation";

// Safe deduplicator for news arrays
function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const rawKey = item.slug || item.id || item.link || item.title;
    if (!rawKey) return false;
    const key = String(rawKey);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function App() {
  return (
    <ConsentProvider>
      <MainPortal />
    </ConsentProvider>
  );
}

function MainPortal() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState<string>("home");
  const [selectedPost, setSelectedPost] = useState<NewsItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const perPage = 12;

  // Data states
  const [news, setNews] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(staticCategories as CategoryItem[]);
  const [sources, setSources] = useState<NewsSource[]>(staticSources as NewsSource[]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);
  const [isAdminMetricsOpen, setIsAdminMetricsOpen] = useState<boolean>(false);

  // Random rotation seeds for intelligent section rotation across page refreshes (purely random, not alphabetical)
  const [carouselSeed, setCarouselSeed] = useState<number>(() => getRandomSeed());
  const [radarSeed, setRadarSeed] = useState<number>(() => getRandomSeed() + 500);
  const [sidebarSeed, setSidebarSeed] = useState<number>(() => getRandomSeed() + 1000);

  const handleRotateNextRadar = () => setRadarSeed((prev) => prev + Math.floor(Math.random() * 9999) + 1);
  const handleRotateNextCarousel = () => setCarouselSeed((prev) => prev + Math.floor(Math.random() * 9999) + 1);

  // Check query parameter for admin metrics (?admin=metrics or ?metrics=1)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "metrics" || params.get("metrics") === "1") {
        setIsAdminMetricsOpen(true);
      }
    } catch {}
  }, []);

  // Hybrid news loading & Realtime synchronization (RTDB onValue + SSE + API sync silencioso)
  useEffect(() => {
    // Inscrição em tempo real silenciosa (sem poluir o frontend com textos/avisos)
    const unsubscribeRealtime = trafficRouter.subscribeToRealtimeNews((updatedNews) => {
      if (updatedNews && updatedNews.length > 0) {
        setNews(sortNewsChronological(deduplicateNews(updatedNews)));
      }
    });

    async function loadData() {
      try {
        const catRes = await fetch("/api/categories");
        if (catRes.ok) {
          const catJson = await catRes.json();
          if (catJson.success && Array.isArray(catJson.data) && catJson.data.length > 0) {
            setCategories(catJson.data);
          }
        }
      } catch (err) {
        console.warn("Failed to load /api/categories:", err);
      }

      try {
        setIsLoadingNews(true);

        // 1. Attempt hybrid fetch through Firebase traffic router
        const hybridResult = await trafficRouter.fetchNews();
        if (hybridResult && hybridResult.news && hybridResult.news.length > 0) {
          setNews(sortNewsChronological(deduplicateNews(hybridResult.news)));
        } else {
          // 2. Fallback to server endpoint
          const newsRes = await fetch("/api/news?all=true");
          if (newsRes.ok) {
            const newsJson = await newsRes.json();
            if (newsJson.success && Array.isArray(newsJson.data) && newsJson.data.length > 0) {
              setNews(sortNewsChronological(deduplicateNews(newsJson.data)));
            }
          }
        }

        // Non-blocking visitor metric logging for administration
        trafficRouter.logMetricEvent("visit", {
          pathname: window.location.pathname,
          referrer: document.referrer || "direct",
        });
      } catch (err) {
        console.warn("Notice: Realtime sync connection notice:", err);
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadData();

    return () => {
      unsubscribeRealtime();
    };
  }, []);

  // Category feed guaranteeing at least 250 items per category with rich tag counts
  const categoryFeed = useMemo(() => {
    return buildCategoryFeed(selectedCategory, news);
  }, [selectedCategory, news]);

  // Filtered and sorted news (Category feed + tag filter + source + search)
  const filteredNews = useMemo(() => {
    let result = [...categoryFeed.items];

    // Filter by Tag
    if (selectedTag) {
      result = result.filter((item) =>
        item.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    // Filter by Source ID
    if (selectedSourceId) {
      result = result.filter((item) => item.sourceId === selectedSourceId);
    }

    // Filter by Search Query with advanced scoring
    if (searchTerm.trim()) {
      result = searchNews(result, searchTerm);
      return result;
    }

    // Default Sort: Chronological (newest first)
    result.sort((a, b) => {
      const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [categoryFeed, selectedTag, selectedSourceId, searchTerm]);

  // Paginated items for the current page
  const totalPages = Math.ceil(filteredNews.length / perPage) || 1;
  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * perPage;
    return filteredNews.slice(startIndex, startIndex + perPage);
  }, [filteredNews, currentPage, perPage]);

  // 1. Dynamic Carousel: Rotates to a random editoria on every refresh; displays clicked editoria strictly
  const carouselData = useMemo(() => {
    return getCarouselNews(news, selectedCategory, carouselSeed, 6);
  }, [news, selectedCategory, carouselSeed]);

  // 2. Dynamic Radar Editorial (Pre-Footer): Rotates to a random editoria on every refresh; displays clicked editoria strictly
  const radarEditorialData = useMemo(() => {
    return getRadarEditorialNews(news, selectedCategory, radarSeed, 8);
  }, [news, selectedCategory, radarSeed]);

  // 3. Dynamic Sidebar Recent News: Rotates across 5 distinct random editorias, or displays clicked editoria strictly
  const sidebarData = useMemo(() => {
    return getSidebarNews(news, selectedCategory, sidebarSeed, 5);
  }, [news, selectedCategory, sidebarSeed]);

  // Handler to navigate between pages
  const handleNavigate = (view: string) => {
    setCurrentView(view);
    window.history.pushState({ view }, "", view === "home" ? "/" : `/${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler to open consent preferences
  const handleOpenConsentSettings = () => {
    setCurrentView("consentimento");
    window.history.pushState({ view: "consentimento" }, "", "/consentimento");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler when selecting a news item: Centers visible area on image/title
  const handleSelectNews = (item: NewsItem) => {
    setSelectedPost(item);
    setCurrentView("post");
    const targetSlug = item.slug || `post/${item.id}`;
    window.history.pushState({ view: "post", postId: item.id }, "", `/${targetSlug}`);

    setTimeout(() => {
      const el = document.getElementById("post-detail-page");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 180, behavior: "smooth" });
      }
    }, 60);
  };

  // Handler when selecting a category
  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedTag(null);
    setCurrentPage(1);
    setSelectedSourceId(undefined);
    if (currentView !== "home") {
      setCurrentView("home");
    }
    const targetUrl = !category || category === "Todas" ? "/" : `/categoria/${categoryToSlug(category)}`;
    window.history.pushState({ view: "home", category }, "", targetUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state?.view) {
        setCurrentView(state.view);
        if (state.view === "post" && state.postId) {
          const post = news.find((n) => n.id === state.postId);
          if (post) setSelectedPost(post);
        } else if (state.view === "home" && state.category) {
          setSelectedCategory(state.category);
        }
      } else {
        const path = window.location.pathname;
        if (path === "/" || path === "") {
          setCurrentView("home");
          setSelectedCategory("Todas");
        } else if (path.startsWith("/categoria/")) {
          const rawSlug = path.replace("/categoria/", "").trim();
          const matched = categories.find((c) => matchCategories(c.category, rawSlug));
          if (matched) {
            setSelectedCategory(matched.category);
          } else {
            setSelectedCategory(decodeURIComponent(rawSlug));
          }
          setCurrentView("home");
        } else {
          const slug = path.substring(1);
          if (["privacidade", "termos", "cookies", "lgpd", "consentimento", "contato"].includes(slug)) {
            setCurrentView(slug);
          } else {
            const post = news.find(
              (n) => n.slug === slug || n.slug === `post/${slug}` || String(n.id) === slug.replace("post-", "")
            );
            if (post) {
              setSelectedPost(post);
              setCurrentView("post");
            }
          }
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [news, categories]);

  // Initial route parsing
  useEffect(() => {
    if (news.length > 0 && !window.history.state?.view) {
      const path = window.location.pathname;
      if (path !== "/" && path !== "") {
        if (path.startsWith("/categoria/")) {
          const rawSlug = path.replace("/categoria/", "").trim();
          const matched = categories.find((c) => matchCategories(c.category, rawSlug));
          if (matched) {
            setSelectedCategory(matched.category);
          } else {
            setSelectedCategory(decodeURIComponent(rawSlug));
          }
          setCurrentView("home");
        } else {
          const slug = path.substring(1);
          if (["privacidade", "termos", "cookies", "lgpd", "consentimento", "contato"].includes(slug)) {
            setCurrentView(slug);
          } else {
            const post = news.find(
              (n) => n.slug === slug || n.slug === `post/${slug}` || String(n.id) === slug.replace("post-", "")
            );
            if (post) {
              setSelectedPost(post);
              setCurrentView("post");
            }
          }
        }
      }
    }
  }, [news, categories]);

  // Sync document.title for SEO and browser tabs
  useEffect(() => {
    let title = "Norma Jurídica - Portal de Notícias e Legislação";
    let desc = "Portal de Notícias Avançado e Responsivo é uma plataforma digital completa de jornalismo moderno, desenvolvida com foco em alta performance e conteúdo jornalístico.";
    let url = window.location.href;
    let img = window.location.origin + "/og-image.jpg";
    let jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Norma Jurídica",
      "url": window.location.origin,
      "potentialAction": {
        "@type": "SearchAction",
        "target": window.location.origin + "/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    if (currentView === "post" && selectedPost) {
      title = `${selectedPost.title} - Norma Jurídica`;
      desc = selectedPost.description || desc;
      img = selectedPost.thumbnail || selectedPost.imageUrl || img;
      if (img.startsWith("/")) img = window.location.origin + img;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "image": [img],
        "datePublished": selectedPost.pubDate,
        "author": [{
          "@type": "Person",
          "name": selectedPost.author || "Norma Jurídica",
          "url": window.location.origin
        }],
        "publisher": {
          "@type": "Organization",
          "name": "Norma Jurídica",
          "logo": {
            "@type": "ImageObject",
            "url": window.location.origin + "/logo.jpg"
          }
        }
      };
    } else if (currentView === "home") {
      if (selectedCategory && selectedCategory !== "Todas") {
        title = `${selectedCategory} - Notícias - Norma Jurídica`;
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": title,
          "description": desc,
          "url": url
        };
      } else {
        title = "Norma Jurídica - Portal de Notícias e Legislação";
      }
    } else if (currentView === "privacidade") {
      title = "Política de Privacidade - Norma Jurídica";
    } else if (currentView === "termos") {
      title = "Termos de Uso - Norma Jurídica";
    } else if (currentView === "cookies") {
      title = "Política de Cookies - Norma Jurídica";
    } else if (currentView === "lgpd") {
      title = "Portal LGPD - Norma Jurídica";
    } else if (currentView === "consentimento") {
      title = "Preferências de Privacidade - Norma Jurídica";
    } else if (currentView === "contato") {
      title = "Fale Conosco - Norma Jurídica";
    }

    updateClientSEO(title, desc, url, img, jsonLd);
  }, [currentView, selectedPost, selectedCategory]);

  // Related posts for current post
  const relatedPosts = useMemo(() => {
    if (!selectedPost) return [];
    return news
      .filter((n) => n.id !== selectedPost.id && n.category === selectedPost.category)
      .slice(0, 3);
  }, [news, selectedPost]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Header */}
      <Header
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onNavigate={handleNavigate}
        currentView={currentView}
        onSearch={(term) => {
          setSearchTerm(term);
          setCurrentPage(1);
          if (currentView !== "home") setCurrentView("home");
        }}
        searchTerm={searchTerm}
        totalNewsCount={news.length}
        onOpenSourcesModal={() => setIsSourcesModalOpen(true)}
        onOpenMetrics={() => setIsAdminMetricsOpen(true)}
      />

      {/* 2. Main Layout Container: Content Area (left) + Right Sidebar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content Column (8 cols on desktop) */}
          <div className="lg:col-span-8 w-full">
            {currentView === "home" && (
              <HomePage
                news={paginatedNews}
                allNewsCount={filteredNews.length}
                carouselNews={carouselData.items}
                carouselCategory={carouselData.featuredCategory}
                isCarouselFiltered={carouselData.isFiltered}
                onRotateCarousel={handleRotateNextCarousel}
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                onSelectNews={handleSelectNews}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                perPage={perPage}
                searchTerm={searchTerm}
                onClearSearch={() => setSearchTerm("")}
                selectedSourceId={selectedSourceId}
                onClearSourceFilter={() => setSelectedSourceId(undefined)}
                isLoading={isLoadingNews}
                categoryTags={categoryFeed.tags}
                categoryTagCount={categoryFeed.tag_count}
                selectedTag={selectedTag}
                onSelectTag={(tag) => {
                  setSelectedTag(tag);
                  setCurrentPage(1);
                }}
              />
            )}

            {currentView === "post" && selectedPost && (
              <PostDetailPage
                post={selectedPost}
                relatedPosts={relatedPosts}
                onBack={() => handleNavigate("home")}
                onSelectPost={handleSelectNews}
                onSelectCategory={handleSelectCategory}
              />
            )}

            {currentView === "privacidade" && (
              <PrivacyPolicyPage
                onBack={() => handleNavigate("home")}
                onNavigateToLgpd={() => handleNavigate("lgpd")}
                onNavigateToConsent={handleOpenConsentSettings}
              />
            )}

            {currentView === "termos" && (
              <TermsOfUsePage
                onBack={() => handleNavigate("home")}
                onNavigateToContact={() => handleNavigate("contato")}
              />
            )}

            {currentView === "cookies" && (
              <CookiePolicyPage
                onBack={() => handleNavigate("home")}
                onNavigateToConsent={handleOpenConsentSettings}
              />
            )}

            {currentView === "lgpd" && (
              <LgpdPortalPage
                onBack={() => handleNavigate("home")}
                onNavigateToConsent={handleOpenConsentSettings}
              />
            )}

            {currentView === "consentimento" && (
              <ConsentManagementPage
                onBack={() => handleNavigate("home")}
                onNavigateToPrivacy={() => handleNavigate("privacidade")}
              />
            )}

            {currentView === "contato" && (
              <ContactPage
                onBack={() => handleNavigate("home")}
                onNavigateToLgpd={() => handleNavigate("lgpd")}
              />
            )}
          </div>

          {/* Right Sidebar (4 cols on desktop) */}
          <div className="lg:col-span-4 w-full">
            <RightSidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              onOpenSourcesModal={() => setIsSourcesModalOpen(true)}
              totalSourcesCount={sources.length}
              recentNews={sidebarData.items}
              onSelectNews={handleSelectNews}
            />
          </div>
        </div>
      </main>

      {/* 3. Pre-Footer Grid (Radar Editorial - Destaques da Redação) */}
      <FooterGrid
        news={radarEditorialData.items}
        featuredCategory={radarEditorialData.featuredCategory}
        isFilteredByCategory={radarEditorialData.isFiltered}
        onSelectNews={handleSelectNews}
        onSelectCategory={handleSelectCategory}
        onRotateCategory={handleRotateNextRadar}
      />

      {/* 4. Footer */}
      <Footer
        onNavigate={handleNavigate}
        currentView={currentView}
        onOpenConsentSettings={handleOpenConsentSettings}
        onOpenAdminMetrics={() => setIsAdminMetricsOpen(true)}
      />

      {/* 5. Floating LGPD Cookie Banner */}
      <CookieBanner onNavigateToConsent={handleOpenConsentSettings} />

      {/* 6. Sources Modal */}
      <SourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        sources={sources}
        onFilterBySource={(s) => {
          setSelectedSourceId(s.id);
          setSelectedCategory("Todas");
          setCurrentPage(1);
          if (currentView !== "home") setCurrentView("home");
        }}
      />

      {/* 7. Admin Metrics & Firebase RTDB Modal */}
      <AdminMetricsModal
        isOpen={isAdminMetricsOpen}
        onClose={() => setIsAdminMetricsOpen(false)}
      />
    </div>
  );
}
