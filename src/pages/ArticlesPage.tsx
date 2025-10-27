import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ArticlePreview from '../components/ArticlePreview';
import ShoppingCartBubble from '../components/ShoppingCartBubble';
import DashboardBubble from '../components/DashboardBubble';
import MobileNavBar from '../components/MobileNavBar';
import ShoppingCartModal from '../components/ShoppingCartModal';
import DashboardModal from '../components/DashboardModal';
import { useSEO } from '../hooks/useSEO';
import { useDebounce } from '../hooks/useDebounce';
import { articles } from '../data/articles';
import { Search, Filter, X } from 'lucide-react';

const ArticlesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [filteredArticles, setFilteredArticles] = useState(articles);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'readTime' | 'title'>('date');

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const categories = Array.from(new Set(articles.map(article => article.category)));

  // SEO optimization
  useSEO({
    title: searchQuery 
      ? `جستجو: ${searchQuery} | مقالات آموزشی سای جی`
      : 'مقالات آموزشی | سای جی',
    description: searchQuery
      ? `نتایج جستجو برای "${searchQuery}" در مقالات آموزشی سای جی`
      : 'مقالات آموزشی جامع درباره سرویس‌های آنلاین، تلگرام پریمیوم، اسپاتیفای، چت جی‌پی‌تی و سایر سرویس‌های اشتراکی',
    keywords: ['مقالات آموزشی', 'راهنمای سرویس های آنلاین', 'تلگرام پریمیوم', 'اسپاتیفای', 'چت جی پی تی'],
    canonicalUrl: 'https://psygstore.com/articles',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "مقالات آموزشی سای جی",
      "description": "مقالات آموزشی جامع درباره سرویس‌های آنلاین",
      "url": "https://psygstore.com/articles",
      "publisher": {
        "@type": "Organization",
        "name": "سای جی"
      },
      "blogPost": articles.map(article => ({
        "@type": "BlogPosting",
        "headline": article.title,
        "description": article.excerpt,
        "url": `https://psygstore.com/articles/${article.slug}`,
        "datePublished": article.date,
        "author": {
          "@type": "Organization",
          "name": "سای جی"
        }
      }))
    }
  });

  useEffect(() => {
    let results = [...articles];
    
    // Search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      results = results.filter(article => 
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        article.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }
    
    // Category filter
    if (selectedCategory) {
      results = results.filter(article => article.category === selectedCategory);
    }
    
    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title, 'fa');
        case 'readTime':
          return parseInt(a.readTime) - parseInt(b.readTime);
        case 'date':
        default:
          // Convert Persian date to comparable format (simplified)
          return b.date.localeCompare(a.date, 'fa');
      }
    });
    
    setFilteredArticles(results);
  }, [debouncedSearchQuery, selectedCategory, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSortBy('date');
  };

  const hasActiveFilters = searchQuery || selectedCategory || sortBy !== 'date';

  return (
    <div className="min-h-screen text-white rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Header />
        
        <main className="mt-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#39ff14] mb-2">مقالات آموزشی</h1>
            <p className="text-gray-400">راهنماهای جامع برای استفاده بهینه از سرویس‌های آنلاین</p>
          </div>
          
          {/* Search and Filter Section */}
          <div className="mb-8 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <label htmlFor="article-search" className="sr-only">جستجو در مقالات</label>
              <input
                id="article-search"
                type="text"
                placeholder="جستجو در عنوان، محتوا یا دسته‌بندی مقالات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-[#39ff14]/30 rounded-xl py-4 px-6 pl-12 text-white placeholder-gray-400 focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all text-lg"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  aria-label="پاک کردن جستجو"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 bg-black/50 border border-[#39ff14]/30 rounded-xl py-2 px-4 text-white hover:border-[#39ff14] transition-all"
                aria-expanded={showFilters}
              >
                <Filter className="w-5 h-5" />
                فیلترها
                {hasActiveFilters && (
                  <span className="bg-[#39ff14] text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    !
                  </span>
                )}
              </button>
              
              <div className="text-sm text-gray-400">
                {filteredArticles.length} مقاله یافت شد
              </div>
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-black/40 border border-[#39ff14]/20 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Filter */}
                  <div>
                    <label htmlFor="category-filter" className="block text-white text-sm mb-2">دسته‌بندی</label>
                    <select
                      id="category-filter"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-black/50 border border-[#39ff14]/30 rounded-lg py-2 px-3 text-white appearance-none focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all"
                    >
                      <option value="">همه دسته‌بندی‌ها</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Sort Filter */}
                  <div>
                    <label htmlFor="sort-filter" className="block text-white text-sm mb-2">مرتب‌سازی بر اساس</label>
                    <select
                      id="sort-filter"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'readTime' | 'title')}
                      className="w-full bg-black/50 border border-[#39ff14]/30 rounded-lg py-2 px-3 text-white appearance-none focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all"
                    >
                      <option value="date">تاریخ انتشار</option>
                      <option value="title">عنوان مقاله</option>
                      <option value="readTime">زمان مطالعه</option>
                    </select>
                  </div>
                </div>
                
                {/* Clear Filters */}
                {hasActiveFilters && (
                  <div className="flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="text-[#39ff14] hover:text-white transition-colors text-sm flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      پاک کردن فیلترها
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Results */}
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-black/40 border border-[#39ff14]/20 rounded-xl p-8 max-w-md mx-auto">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">هیچ مقاله‌ای یافت نشد</p>
                <p className="text-gray-500 text-sm">لطفاً کلمات کلیدی دیگری امتحان کنید یا فیلترها را تغییر دهید</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-[#39ff14] hover:text-white transition-colors text-sm"
                  >
                    پاک کردن همه فیلترها
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredArticles.map(article => (
                <ArticlePreview 
                  key={article.id}
                  id={article.slug}
                  title={article.title}
                  excerpt={article.excerpt}
                  imageUrl={article.imageUrl}
                  date={article.date}
                  readTime={article.readTime}
                  category={article.category}
                />
              ))}
            </div>
          )}
        </main>
        
        <Footer />
      </div>
      
      {/* Desktop Bubbles */}
      <div className="hidden md:block">
        <ShoppingCartBubble onClick={() => setIsCartOpen(true)} />
        <DashboardBubble onClick={() => setIsDashboardOpen(true)} />
      </div>
      
      {/* Mobile Navigation */}
      <MobileNavBar 
        onCartClick={() => setIsCartOpen(true)}
        onDashboardClick={() => setIsDashboardOpen(true)}
      />
      
      <ShoppingCartModal 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
      />
      
      <DashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
    </div>
  );
};

export default ArticlesPage;