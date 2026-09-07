import React, { useState, useEffect, useMemo } from "react";
import { NewsItem, CategoryItem, NewsSource } from "./types";
import { ConsentProvider } from "./context/ConsentContext";
import { Header } from "./components/Header";
import { RightSidebar } from "./components/RightSidebar";
import { Footer } from "./components/Footer";
import { FooterGrid } from "./components/FooterGrid";
import { CookieBanner } from "./components/CookieBanner";
import { SourcesModal } from "./components/SourcesModal";

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

// Safe deduplicator for news arrays
function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const rawKey = item.id || item.link || item.title;
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

  // Pagination state (WordPress style)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const perPage = 12;

  // Data states
  const [news, setNews] = useState<NewsItem[]>(() => deduplicateNews(initialNewsData as NewsItem[]));
  const [categories, setCategories] = useState<CategoryItem[]>(staticCategories as CategoryItem[]);
  const [sources, setSources] = useState<NewsSource[]>(staticSources as NewsSource[]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);

  // Load categories and initial news from backend API
  useEffect(() => {
    async function loadData() {
      try {
        // Categories
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
        // News (Fetch all news from all endpoints in chronological order)
        setIsLoadingNews(true);
        const newsRes = await fetch("/api/news?all=true");
        if (newsRes.ok) {
          const newsJson = await newsRes.json();
          if (newsJson.success && Array.isArray(newsJson.data) && newsJson.data.length > 0) {
            setNews(deduplicateNews(newsJson.data));
          }
        }
      } catch (err) {
        console.warn("Failed to load /api/news:", err);
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadData();
  }, []);

  // Filtered and sorted news (Most recent first)
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

    // Filter by Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.sourceSite?.toLowerCase().includes(q)
      );
    }

    // Sort: Most recent first (descending by timestamp)
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
    // Pick the top 6 news from the collection
    return news.slice(0, 6);
  }, [news]);

  // 8 Items for the pre-footer section (2 lines x 4 columns)
  const preFooterNews = useMemo(() => {
    // Pick 8 news items from the feed
    if (news.length >= 8) {
      return news.slice(6, 14);
    }
    return news.slice(0, 8);
  }, [news]);

  // Handler to navigate between pages
  const handleNavigate = (view: string) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler when selecting a news item
  const handleSelectNews = (item: NewsItem) => {
    setSelectedPost(item);
    setCurrentView("post");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler when selecting a category
  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setSelectedSourceId(undefined);
    if (currentView !== "home") {
      setCurrentView("home");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Related posts for current post
  const relatedPosts = useMemo(() => {
    if (!selectedPost) return [];
    return news
      .filter((n) => n.id !== selectedPost.id && n.category === selectedPost.category)
      .slice(0, 3);
  }, [news, selectedPost]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Header (Non-fixed, scrolls with page, holds 50-category menu in 4 lines) */}
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
                onBack={() => setCurrentView("home")}
                onSelectPost={handleSelectNews}
                onSelectCategory={handleSelectCategory}
              />
            )}

            {currentView === "privacidade" && (
              <PrivacyPolicyPage
                onBack={() => setCurrentView("home")}
                onNavigateToLgpd={() => setCurrentView("lgpd")}
                onNavigateToConsent={() => setCurrentView("consentimento")}
              />
            )}

            {currentView === "termos" && (
              <TermsOfUsePage
                onBack={() => setCurrentView("home")}
                onNavigateToContact={() => setCurrentView("contato")}
              />
            )}

            {currentView === "cookies" && (
              <CookiePolicyPage
                onBack={() => setCurrentView("home")}
                onNavigateToConsent={() => setCurrentView("consentimento")}
              />
            )}

            {currentView === "lgpd" && (
              <LgpdPortalPage
                onBack={() => setCurrentView("home")}
                onNavigateToConsent={() => setCurrentView("consentimento")}
              />
            )}

            {currentView === "consentimento" && (
              <ConsentManagementPage
                onBack={() => setCurrentView("home")}
                onNavigateToPrivacy={() => setCurrentView("privacidade")}
              />
            )}

            {currentView === "contato" && (
              <ContactPage
                onBack={() => setCurrentView("home")}
                onNavigateToLgpd={() => setCurrentView("lgpd")}
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
            />
          </div>
        </div>
      </main>

      {/* 3. Mandatory Pre-Footer Grid (2 lines x 4 columns on ALL pages) */}
      <FooterGrid news={preFooterNews} onSelectNews={handleSelectNews} />

      {/* 4. Footer */}
      <Footer
        onNavigate={handleNavigate}
        currentView={currentView}
        onOpenConsentSettings={() => setCurrentView("consentimento")}
      />

      {/* 5. Floating LGPD Cookie Banner */}
      <CookieBanner onNavigateToConsent={() => setCurrentView("consentimento")} />

      {/* 6. 72 News Sources Inspection Modal */}
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
    </div>
  );
}
