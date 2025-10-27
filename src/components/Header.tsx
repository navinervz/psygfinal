import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ShoppingCart, FileText, Bot, Music, MessageSquare, Sparkles } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface SearchResult {
  id: string;
  title: string;
  type: 'product' | 'article';
  description: string;
  category: string;
  icon?: React.ReactNode;
  price?: string;
  readTime?: string;
  url: string;
}

const Header: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Mock data for products and articles
  const searchData: SearchResult[] = [
    // Products
    {
      id: 'telegram-premium',
      title: 'تلگرام پریمیوم',
      type: 'product',
      description: 'اشتراک تلگرام پریمیوم با امکانات ویژه',
      category: 'پیام‌رسان',
      icon: <MessageSquare className="w-5 h-5" />,
      price: 'از ۷۹۵,۰۰۰ تومان',
      url: '/#telegram-premium'
    },
    {
      id: 'spotify',
      title: 'اسپاتیفای',
      type: 'product',
      description: 'اشتراک موسیقی اسپاتیفای',
      category: 'موسیقی',
      icon: <Music className="w-5 h-5" />,
      price: 'از ۵۱۰,۰۰۰ تومان',
      url: '/#spotify'
    },
    {
      id: 'chatgpt',
      title: 'چت جی‌پی‌تی',
      type: 'product',
      description: 'اشتراک هوش مصنوعی چت جی‌پی‌تی',
      category: 'هوش مصنوعی',
      icon: <Bot className="w-5 h-5" />,
      price: 'از ۲,۱۲۵,۰۰۰ تومان',
      url: '/#chatgpt'
    },
    // Articles
    {
      id: 'telegram-premium-guide',
      title: 'راهنمای جامع استفاده از تلگرام پریمیوم',
      type: 'article',
      description: 'آموزش کامل امکانات تلگرام پریمیوم',
      category: 'تلگرام',
      icon: <FileText className="w-5 h-5" />,
      readTime: '۸ دقیقه',
      url: '/articles/telegram-premium-guide'
    },
    {
      id: 'spotify-playlist-optimization',
      title: 'بهینه‌سازی پلی‌لیست‌های اسپاتیفای',
      type: 'article',
      description: 'روش‌های حرفه‌ای مدیریت موسیقی در اسپاتیفای',
      category: 'اسپاتیفای',
      icon: <FileText className="w-5 h-5" />,
      readTime: '۶ دقیقه',
      url: '/articles/spotify-playlist-optimization'
    },
    {
      id: 'chatgpt-advanced-prompts',
      title: 'ترفندهای پیشرفته برای چت جی‌پی‌تی',
      type: 'article',
      description: 'تکنیک‌های مهندسی پرامپت برای نتایج بهتر',
      category: 'هوش مصنوعی',
      icon: <FileText className="w-5 h-5" />,
      readTime: '۱۰ دقیقه',
      url: '/articles/chatgpt-advanced-prompts'
    },
    {
      id: 'online-services-comparison',
      title: 'مقایسه جامع سرویس‌های اشتراکی آنلاین',
      type: 'article',
      description: 'راهنمای انتخاب بهترین سرویس متناسب با نیاز',
      category: 'مقایسه',
      icon: <FileText className="w-5 h-5" />,
      readTime: '۱۵ دقیقه',
      url: '/articles/online-services-comparison'
    }
  ];

  // Smart search function
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Simulate search delay
    setTimeout(() => {
      const normalizedQuery = query.toLowerCase().trim();
      
      const results = searchData.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(normalizedQuery);
        const descriptionMatch = item.description.toLowerCase().includes(normalizedQuery);
        const categoryMatch = item.category.toLowerCase().includes(normalizedQuery);
        
        // Special keyword matching
        const keywordMatches = {
          'تلگرام': ['telegram', 'پیام', 'چت', 'پریمیوم'],
          'اسپاتیفای': ['spotify', 'موسیقی', 'آهنگ', 'پلی لیست'],
          'چت جی پی تی': ['chatgpt', 'gpt', 'هوش مصنوعی', 'ai', 'ربات']
        };
        
        let keywordMatch = false;
        Object.entries(keywordMatches).forEach(([key, keywords]) => {
          if (keywords.some(keyword => normalizedQuery.includes(keyword)) || 
              normalizedQuery.includes(key.toLowerCase())) {
            if (item.title.toLowerCase().includes(key.toLowerCase()) ||
                item.category.toLowerCase().includes(key.toLowerCase())) {
              keywordMatch = true;
            }
          }
        });
        
        return titleMatch || descriptionMatch || categoryMatch || keywordMatch;
      });

      // Sort results: products first, then articles
      const sortedResults = results.sort((a, b) => {
        if (a.type === 'product' && b.type === 'article') return -1;
        if (a.type === 'article' && b.type === 'product') return 1;
        return 0;
      });

      setSearchResults(sortedResults);
      setIsSearching(false);
    }, 300);
  };

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(true);
    performSearch(value);
  };

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/articles?search=${encodeURIComponent(searchQuery)}`);
      setShowResults(false);
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery('');
    
    if (result.url.startsWith('/#')) {
      // Navigate to home page and scroll to element
      navigate('/');
      setTimeout(() => {
        const elementId = result.url.substring(2);
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else if (result.url.startsWith('/articles/')) {
      // Navigate directly to article page
      navigate(result.url);
    } else {
      navigate(result.url);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="text-center mb-10 pt-8 relative z-10">
      {/* Main Title */}
      <div className="relative mb-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white relative">
          <span className="text-[#39ff14] text-shadow-neon font-aghasem relative">
            سای جی
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#39ff14] animate-pulse" />
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-[#39ff14] text-shadow-sm">
          مرجع خرید آسان سرویس‌های آنلاین
        </p>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex justify-center mt-8">
        <nav className="glass rounded-full border border-[#39ff14]/20 p-2 inline-flex items-center backdrop-blur-xl">
          <a href="/" className="px-6 py-3 text-[#39ff14] hover:bg-[#39ff14]/10 rounded-full transition-all duration-300 font-semibold">
            خانه
          </a>
          <a href="/articles" className="px-6 py-3 text-white hover:text-[#39ff14] hover:bg-[#39ff14]/10 rounded-full transition-all duration-300">
            مقالات آموزشی
          </a>
          <a href="/faq" className="px-6 py-3 text-white hover:text-[#39ff14] hover:bg-[#39ff14]/10 rounded-full transition-all duration-300">
            سوالات متداول
          </a>
          
          {/* Smart Search - Desktop */}
          <div ref={searchRef} className="relative mr-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="جستجو محصولات و مقالات..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery && setShowResults(true)}
                className="input-glass w-[280px] text-sm pr-12 pl-12"
              />
              <button type="submit" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#39ff14] hover:text-white transition-colors">
                <Search className="w-5 h-5" />
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </form>

            {/* Search Results Dropdown - Desktop */}
            {showResults && (searchQuery || searchResults.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-black/60 backdrop-blur-[50px] rounded-2xl shadow-xl max-h-[400px] overflow-y-auto z-50 border border-white/20 modal-scrollbar">
                {isSearching ? (
                  <div className="p-6 text-center">
                    <LoadingSpinner size="sm" text="در حال جستجو..." />
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {/* Products Section */}
                    {searchResults.some(r => r.type === 'product') && (
                      <div className="p-4 border-b border-white/10">
                        <h3 className="text-[#39ff14] text-sm font-semibold mb-3 flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          محصولات
                        </h3>
                        {searchResults
                          .filter(result => result.type === 'product')
                          .map(result => (
                            <button
                              key={result.id}
                              onClick={() => handleResultClick(result)}
                              className="w-full text-right p-4 hover:bg-white/10 rounded-xl transition-all group glass-hover"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-[#39ff14] group-hover:text-white transition-colors">
                                  {result.icon}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-white font-medium text-sm group-hover:text-[#39ff14] transition-colors">
                                    {result.title}
                                  </h4>
                                  <p className="text-gray-400 text-xs mt-1">{result.description}</p>
                                  <p className="text-[#39ff14] text-xs font-semibold mt-1">{result.price}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Articles Section */}
                    {searchResults.some(r => r.type === 'article') && (
                      <div className="p-4">
                        <h3 className="text-[#39ff14] text-sm font-semibold mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          مقالات آموزشی
                        </h3>
                        {searchResults
                          .filter(result => result.type === 'article')
                          .map(result => (
                            <button
                              key={result.id}
                              onClick={() => handleResultClick(result)}
                              className="w-full text-right p-4 hover:bg-white/10 rounded-xl transition-all group glass-hover"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-[#39ff14] group-hover:text-white transition-colors">
                                  {result.icon}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-white font-medium text-sm group-hover:text-[#39ff14] transition-colors">
                                    {result.title}
                                  </h4>
                                  <p className="text-gray-400 text-xs mt-1">{result.description}</p>
                                  <p className="text-blue-400 text-xs mt-1">{result.readTime} مطالعه</p>
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                ) : searchQuery ? (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">نتیجه‌ای یافت نشد</p>
                    <p className="text-gray-500 text-xs mt-1">کلمات کلیدی دیگری امتحان کنید</p>
                  </div>
                ) : null}

                {/* View All Results */}
                {searchQuery && searchResults.length > 0 && (
                  <div className="p-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        navigate(`/articles?search=${encodeURIComponent(searchQuery)}`);
                        setShowResults(false);
                      }}
                      className="w-full text-center py-3 text-[#39ff14] hover:text-white transition-colors text-sm font-semibold"
                    >
                      مشاهده همه نتایج →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Mobile Search Only */}
      <div className="md:hidden mt-8">
        <div ref={searchRef} className="relative max-w-sm mx-auto">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="جستجو محصولات و مقالات..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setShowResults(true)}
              className="input-glass w-full text-sm pr-12 pl-12"
            />
            <button type="submit" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#39ff14] hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </form>

          {/* Search Results Dropdown - Mobile */}
          {showResults && (searchQuery || searchResults.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-black/60 backdrop-blur-[50px] rounded-2xl shadow-xl max-h-[300px] overflow-y-auto z-50 border border-white/20 modal-scrollbar">
              {isSearching ? (
                <div className="p-4 text-center">
                  <LoadingSpinner size="sm" text="در حال جستجو..." />
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  {/* Products Section */}
                  {searchResults.some(r => r.type === 'product') && (
                    <div className="p-3 border-b border-white/10">
                      <h3 className="text-[#39ff14] text-sm font-semibold mb-2 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        محصولات
                      </h3>
                      {searchResults
                        .filter(result => result.type === 'product')
                        .map(result => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full text-right p-3 hover:bg-white/10 rounded-lg transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-[#39ff14] group-hover:text-white transition-colors">
                                {result.icon}
                              </div>
                              <div className="flex-1">
                                <h4 className="text-white font-medium text-sm group-hover:text-[#39ff14] transition-colors">
                                  {result.title}
                                </h4>
                                <p className="text-gray-400 text-xs mt-1">{result.description}</p>
                                <p className="text-[#39ff14] text-xs font-semibold mt-1">{result.price}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Articles Section */}
                  {searchResults.some(r => r.type === 'article') && (
                    <div className="p-3">
                      <h3 className="text-[#39ff14] text-sm font-semibold mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        مقالات آموزشی
                      </h3>
                      {searchResults
                        .filter(result => result.type === 'article')
                        .map(result => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full text-right p-3 hover:bg-white/10 rounded-lg transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-[#39ff14] group-hover:text-white transition-colors">
                                {result.icon}
                              </div>
                              <div className="flex-1">
                                <h4 className="text-white font-medium text-sm group-hover:text-[#39ff14] transition-colors">
                                  {result.title}
                                </h4>
                                <p className="text-gray-400 text-xs mt-1">{result.description}</p>
                                <p className="text-blue-400 text-xs mt-1">{result.readTime} مطالعه</p>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              ) : searchQuery ? (
                <div className="p-4 text-center">
                  <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">نتیجه‌ای یافت نشد</p>
                  <p className="text-gray-500 text-xs mt-1">کلمات کلیدی دیگری امتحان کنید</p>
                </div>
              ) : null}

              {/* View All Results */}
              {searchQuery && searchResults.length > 0 && (
                <div className="p-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      navigate(`/articles?search=${encodeURIComponent(searchQuery)}`);
                      setShowResults(false);
                    }}
                    className="w-full text-center py-2 text-[#39ff14] hover:text-white transition-colors text-sm"
                  >
                    مشاهده همه نتایج →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;