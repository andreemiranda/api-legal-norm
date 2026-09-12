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
import initialNewsData from "./data/initialNews.json";
import { searchNews } from "./utils/search";

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
  const [selectedSourceId, setSelectedSourceId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const perPage = 12;

  // Data states
  const [news, setNews] = useState<NewsItem[]>(() => deduplicateNews(initialNewsData as NewsItem[]));
  const [categories, setCategories] = useState<CategoryItem[]>(staticCategories as CategoryItem[]);
  const [sources, setSources] = useState<NewsSource[]>(staticSources as NewsSource[]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);
  const [isAdminMetricsOpen, setIsAdminMetricsOpen] = useState<boolean>(false);

  // Check query parameter for admin metrics (?admin=metrics or ?metrics=1)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "metrics" || params.get("metrics") === "1") {
        setIsAdminMetricsOpen(true);
      }
    } catch {}
  }, []);

  // Hybrid news loading: Firebase RTDB (Primary or Mirror with automatic 9GB rotation) + in-code static fallback
  useEffect(() => {
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
          setNews(deduplicateNews(hybridResult.news));
        } else {
          // 2. Fallback to server endpoint
          const newsRes = await fetch("/api/news?all=true");
          if (newsRes.ok) {
            const newsJson = await newsRes.json();
            if (newsJson.success && Array.isArray(newsJson.data) && newsJson.data.length > 0) {
              setNews(deduplicateNews(newsJson.data));
            }
          }
        }

        // Non-blocking visitor metric logging for administration
        trafficRouter.logMetricEvent("visit", {
          pathname: window.location.pathname,
          referrer: document.referrer || "direct",
        });
      } catch (err) {
        console.warn("Notice: Using static in-code news fallback:", err);
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadData();
  }, []);

  // Filtered and sorted news (With multi-token relevance scoring)
  const filteredNews = useMemo(() => {
    let result = [...news];

    // Filter by Category
    if (selectedCategory && selectedCategory !== "Todas") {
      result = result.filter(
        (item) => item.category?.toLowerCase() === selectedCategory.toLowerCase()
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
  }, [news, selectedCategory, selectedSourceId, searchTerm]);

  // Paginated items for the current page
  const totalPages = Math.ceil(filteredNews.length / perPage) || 1;
  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * perPage;
    return filteredNews.slice(startIndex, startIndex + perPage);
  }, [filteredNews, currentPage, perPage]);

  // 6 Items for the Home Carousel
  const carouselNews = useMemo(() => {
    return news.slice(0, 6);
  }, [news]);

  // 8 Items for the pre-footer section
  const preFooterNews = useMemo(() => {
    if (news.length >= 8) {
      return news.slice(6, 14);
    }
    return news.slice(0, 8);
  }, [news]);

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
    setCurrentPage(1);
    setSelectedSourceId(undefined);
    if (currentView !== "home") {
      setCurrentView("home");
    }
    window.history.pushState({ view: "home", category }, "", "/");
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
  }, [news]);

  // Initial route parsing
  useEffect(() => {
    if (news.length > 0 && !window.history.state?.view) {
      const path = window.location.pathname;
      if (path !== "/" && path !== "") {
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
  }, [news]);

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
                carouselNews={carouselNews}
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
              recentNews={news.slice(0, 10)}
              onSelectNews={handleSelectNews}
            />
          </div>
        </div>
      </main>

      {/* 3. Pre-Footer Grid (2 lines x 4 columns) */}
      <FooterGrid news={preFooterNews} onSelectNews={handleSelectNews} />

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
