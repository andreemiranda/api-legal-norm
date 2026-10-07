import { updateClientSEO } from "./utils/seoUtils";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { firebaseAuthService, AdminUserState } from "./services/firebaseAuthService";
import { RefreshCw } from "lucide-react";

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

  // Realtime updates buffer state:
  // As novidades chegam continuamente da API em segundo plano, mas só aparecem na próxima atualização ou reinício de página
  const [pendingNews, setPendingNews] = useState<NewsItem[] | null>(null);
  const [newArticlesCount, setNewArticlesCount] = useState<number>(0);

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
  const [authState, setAuthState] = useState<AdminUserState>(firebaseAuthService.getUserState());

  const applyPendingRealtimeNews = useCallback(() => {
    if (pendingNews && pendingNews.length > 0) {
      setNews(pendingNews);
      setPendingNews(null);
      setNewArticlesCount(0);
      try {
        localStorage.removeItem("norma_pending_realtime_news");
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pendingNews]);

  useEffect(() => {
    const unsub = firebaseAuthService.subscribe((state) => {
      setAuthState(state);
    });
    return () => unsub();
  }, []);

  // Random rotation seeds for intelligent section rotation across page refreshes (purely random, not alphabetical)
  const [carouselSeed, setCarouselSeed] = useState<number>(() => getRandomSeed());
  const [radarSeed, setRadarSeed] = useState<number>(() => getRandomSeed() + 500);
  const [sidebarSeed, setSidebarSeed] = useState<number>(() => getRandomSeed() + 1000);
  const [feedSeed, setFeedSeed] = useState<number>(() => getRandomSeed() + 2000);

  const handleRotateNextRadar = () => setRadarSeed((prev) => prev + Math.floor(Math.random() * 9999) + 1);
  const handleRotateNextCarousel = () => setCarouselSeed((prev) => prev + Math.floor(Math.random() * 9999) + 1);
  const handleRotateFeed = () => setFeedSeed((prev) => prev + Math.floor(Math.random() * 9999) + 1);

  // Check query parameter for admin metrics (?admin=metrics or ?metrics=1)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "metrics" || params.get("metrics") === "1") {
        if (authState.isAdmin) {
          setIsAdminMetricsOpen(true);
        }
      }
    } catch {}
  }, [authState.isAdmin]);

  // Realtime news loader from upstream API with background sync & visibilitychange
  const loadLatestRealtimeNews = useCallback(async (isSilent = false, forceBackendSync = false) => {
    try {
      if (!isSilent) setIsLoadingNews(true);
      
      if (forceBackendSync) {
        // Trigger server-side upstream API synchronization with Netlify fallback
        fetch("/api/monitoring/sync?fast=true", { method: "POST" }).catch(() => {});
      }

      const newsRes = await fetch(`/api/news?all=true&_t=${Date.now()}&refresh=true`);
      if (newsRes.ok) {
        const newsJson = await newsRes.json();
        if (newsJson.success && Array.isArray(newsJson.data) && newsJson.data.length > 0) {
          const freshData = sortNewsChronological(deduplicateNews(newsJson.data));
          
          if (isSilent) {
            setNews((curr) => {
              if (curr.length === 0) return freshData;
              const currentIds = new Set(curr.map((n) => String(n.id || n.slug || n.title)));
              const diff = freshData.filter((n) => !currentIds.has(String(n.id || n.slug || n.title)));
              if (diff.length > 0) {
                setPendingNews(freshData);
                setNewArticlesCount(diff.length);
                try {
                  localStorage.setItem("norma_pending_realtime_news", JSON.stringify(freshData));
                } catch {}
              }
              return curr;
            });
          } else {
            setNews(freshData);
          }
          return;
        }
      }
      // Hybrid fallback
      const hybridResult = await trafficRouter.fetchNews(true);
      if (hybridResult && hybridResult.news && hybridResult.news.length > 0) {
        const fallbackData = sortNewsChronological(deduplicateNews(hybridResult.news));
        if (isSilent) {
          setNews((curr) => {
            if (curr.length === 0) return fallbackData;
            return curr;
          });
        } else {
          setNews(fallbackData);
        }
      }
    } catch (err) {
      console.warn("Realtime sync notice:", err);
    } finally {
      if (!isSilent) setIsLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    // 0. Ao iniciar/reiniciar a página, aplica imediatamente as matérias pendentes acumuladas em tempo real
    try {
      const stored = localStorage.getItem("norma_pending_realtime_news");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNews(sortNewsChronological(deduplicateNews(parsed)));
          localStorage.removeItem("norma_pending_realtime_news");
        }
      }
    } catch {}

    // 1. Initial news fetch directly from real-time server
    loadLatestRealtimeNews();

    // 2. Categories load
    fetch("/api/categories")
      .then((r) => r.json())
      .then((catJson) => {
        if (catJson.success && Array.isArray(catJson.data) && catJson.data.length > 0) {
          setCategories(catJson.data);
        }
      })
      .catch(() => {});

    // 3. Realtime SSE / listener: recebe atualizações contínuas em tempo real da API
    const unsubscribeRealtime = trafficRouter.subscribeToRealtimeNews((updatedNews) => {
      if (!updatedNews || updatedNews.length === 0) return;
      const sorted = sortNewsChronological(deduplicateNews(updatedNews));

      setNews((currentNews) => {
        // Se ainda não há notícias na tela, exibe imediatamente
        if (currentNews.length === 0) {
          return sorted;
        }

        // Se o leitor já está navegando, detecta as novidades e agenda para a próxima atualização ou reinício de página
        const currentIds = new Set(currentNews.map((n) => String(n.id || n.slug || n.title)));
        const freshItems = sorted.filter((n) => !currentIds.has(String(n.id || n.slug || n.title)));

        if (freshItems.length > 0) {
          setPendingNews(sorted);
          setNewArticlesCount(freshItems.length);
          try {
            localStorage.setItem("norma_pending_realtime_news", JSON.stringify(sorted));
          } catch {}
          // Mantém as matérias atuais na tela para não interromper a leitura
          return currentNews;
        }

        return currentNews;
      });
    });

    // 4. Automatic sync a cada 60 segundos para notícias em tempo real
    const SIXTY_SECONDS_MS = 60 * 1000;
    const intervalId = setInterval(() => {
      loadLatestRealtimeNews(true, true);
    }, SIXTY_SECONDS_MS);

    // 5. Automatic sync quando o usuário retorna à aba (visibilitychange)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadLatestRealtimeNews(true, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribeRealtime();
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadLatestRealtimeNews]);

  // Category feed guaranteeing strict category isolation,
  // and balanced rotation of all categories when viewing "Todas"
  const categoryFeed = useMemo(() => {
    return buildCategoryFeed(selectedCategory, news, feedSeed);
  }, [selectedCategory, news, feedSeed]);

  // Filtered and sorted news (Category feed + tag filter + source + search)
  const filteredNews = useMemo(() => {
    // Pesquisa: agora procura em TODO o acervo (por matérias)
    if (searchTerm.trim()) {
      let searched = searchNews(news, searchTerm);
      if (selectedTag) {
        searched = searched.filter((item) =>
          item.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
        );
      }
      if (selectedSourceId) {
        searched = searched.filter((item) => item.sourceId === selectedSourceId);
      }
      // Se não encontrar termos exatos na busca, exibe as principais da editoria para nunca deixar sem notícias
      if (searched.length === 0 && categoryFeed.items.length > 0) {
        return categoryFeed.items;
      }
      return searched;
    }

    let result = [...categoryFeed.items];

    // Filter by Tag
    if (selectedTag) {
      const filteredByTag = result.filter((item) =>
        item.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
      );
      if (filteredByTag.length > 0) {
        result = filteredByTag;
      }
    }

    // Filter by Source ID
    if (selectedSourceId) {
      const filteredBySource = result.filter((item) => item.sourceId === selectedSourceId);
      if (filteredBySource.length > 0) {
        result = filteredBySource;
      }
    }

    // If specific category is selected, sort strictly chronologically (newest first)
    // If "Todas", the balanced rotating feed has already balanced all categories across pages
    // and ordered each page strictly from newest to oldest!
    if (selectedCategory && selectedCategory !== "Todas") {
      result.sort((a, b) => {
        const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return timeB - timeA;
      });
    }

    // Garantia absoluta: nenhuma editoria fica sem notícias exibidas
    if (result.length === 0 && categoryFeed.items.length > 0) {
      return categoryFeed.items;
    }

    return result;
  }, [news, categoryFeed, selectedCategory, selectedTag, selectedSourceId, searchTerm]);

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
    // Aplica notícias atualizadas em tempo real na próxima navegação
    if (pendingNews && pendingNews.length > 0) {
      setNews(pendingNews);
      setPendingNews(null);
      setNewArticlesCount(0);
      try {
        localStorage.removeItem("norma_pending_realtime_news");
      } catch {}
    }
    setCurrentView(view);
    if (view === "home") {
      handleRotateFeed();
      handleRotateNextCarousel();
      handleRotateNextRadar();
    }
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
    // Aplica notícias atualizadas em tempo real na próxima navegação de categoria
    if (pendingNews && pendingNews.length > 0) {
      setNews(pendingNews);
      setPendingNews(null);
      setNewArticlesCount(0);
      try {
        localStorage.removeItem("norma_pending_realtime_news");
      } catch {}
    }
    setSelectedCategory(category);
    setSelectedTag(null);
    setCurrentPage(1);
    setSelectedSourceId(undefined);

    // When clicking "Todas" or switching categories, refresh the rotation seeds
    // so every update/click produces a fresh permutation allowing all categories to cycle on page 1
    handleRotateFeed();
    handleRotateNextCarousel();
    handleRotateNextRadar();

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
          if (state.category === "Todas") {
            handleRotateFeed();
            handleRotateNextCarousel();
            handleRotateNextRadar();
          }
        }
      } else {
        const path = window.location.pathname;
        if (path === "/" || path === "") {
          setCurrentView("home");
          setSelectedCategory("Todas");
          handleRotateFeed();
          handleRotateNextCarousel();
          handleRotateNextRadar();
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
    const rawDomain = import.meta.env.VITE_PRIMARY_DOMAIN || window.location.origin;
    const primaryDomain = rawDomain.replace(/\/$/, "");

    let title = "Norma Jurídica - Portal de Notícias e Legislação";
    let desc = "Portal de Notícias Avançado e Responsivo é uma plataforma digital completa de jornalismo moderno, desenvolvida com foco em alta performance e conteúdo jornalístico.";
    
    // Constrói a URL usando o domínio principal (para canonical e og:url)
    let url = primaryDomain + window.location.pathname + window.location.search;
    let img = primaryDomain + "/og-image.jpg";
    let jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Norma Jurídica",
      "url": primaryDomain,
      "potentialAction": {
        "@type": "SearchAction",
        "target": primaryDomain + "/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    if (currentView === "post" && selectedPost) {
      title = `${selectedPost.title} - Norma Jurídica`;
      desc = selectedPost.description || desc;
      img = selectedPost.thumbnail || selectedPost.imageUrl || img;
      if (img.startsWith("/")) img = primaryDomain + img;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "image": [img],
        "datePublished": selectedPost.pubDate,
        "author": [{
          "@type": "Person",
          "name": selectedPost.author || "Norma Jurídica",
          "url": primaryDomain
        }],
        "publisher": {
          "@type": "Organization",
          "name": "Norma Jurídica",
          "logo": {
            "@type": "ImageObject",
            "url": primaryDomain + "/logo.jpg"
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

      {/* 1b. Realtime Updates Available Alert / Notification Bar */}
      {newArticlesCount > 0 && (
        <aside
          aria-label="Notícias atualizadas em tempo real"
          className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 border-b border-blue-500/40 px-4 py-2 text-xs text-slate-200 shadow-lg sticky top-0 z-40 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <span className="font-semibold text-white">
                {newArticlesCount} {newArticlesCount === 1 ? "nova matéria atualizada" : "novas matérias atualizadas"} em tempo real de acordo com a API.
              </span>
              <span className="hidden md:inline text-slate-400 text-[11px]">
                (As notícias serão exibidas na próxima atualização ou ao reiniciar a página)
              </span>
            </div>
            <button
              onClick={applyPendingRealtimeNews}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Carregar Agora
            </button>
          </div>
        </aside>
      )}

      {/* 2. Main Layout Container: Content Area (left) + Right Sidebar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content Column (8 cols on desktop) */}
          <div className="lg:col-span-8 w-full max-w-full overflow-hidden min-w-0">
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
          <div className="lg:col-span-4 w-full max-w-full overflow-hidden min-w-0">
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

      {/* 7. Admin Metrics & Firebase RTDB Modal - Only visible to administrators */}
      {isAdminMetricsOpen && authState.isAdmin && (
        <AdminMetricsModal
          isOpen={isAdminMetricsOpen}
          onClose={() => setIsAdminMetricsOpen(false)}
        />
      )}
    </div>
  );
}
