import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ShoppingCartBubble from '../components/ShoppingCartBubble';
import DashboardBubble from '../components/DashboardBubble';
import MobileNavBar from '../components/MobileNavBar';
import ShoppingCartModal from '../components/ShoppingCartModal';
import DashboardModal from '../components/DashboardModal';
import ProductIcon from '../components/ProductIcon';
import LazyImage from '../components/LazyImage';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { useNotificationContext } from '../context/NotificationContext';
import { useSEO } from '../hooks/useSEO';
import { articles } from '../data/articles';
import { Clock, Calendar, Tag, Share2, BookOpen, ArrowRight, ShoppingCart, Check, ThumbsUp, ThumbsDown, Star, MessageCircle, ExternalLink, Zap, Shield, Award } from 'lucide-react';

// Product data for quick purchase
const productData = {
  'telegram-premium': {
    id: 'telegram-premium',
    title: 'تلگرام پریمیوم',
    options: [
      { name: "اشتراک ماهانه", value: 795000, formattedValue: "۷۹۵,۰۰۰ تومان" },
      { name: "اشتراک سه‌ماهه", value: 1246000, formattedValue: "۱٬۲۴۶٬۰۰۰ تومان" },
      { name: "اشتراک شش‌ماهه", value: 1728000, formattedValue: "۱٬۷۲۸٬۰۰۰ تومان" },
      { name: "اشتراک سالانه", value: 3200000, formattedValue: "۳٬۲۰۰٬۰۰۰ تومان" }
    ]
  },
  'spotify': {
    id: 'spotify',
    title: 'اسپاتیفای',
    options: [
      { name: "اشتراک ماهانه", value: 510000, formattedValue: "۵۱۰٬۰۰۰ تومان" },
      { name: "اشتراک دوماهه", value: 893000, formattedValue: "۸۹۳٬۰۰۰ تومان" },
      { name: "اشتراک سه‌ماهه", value: 1115000, formattedValue: "۱٬۱۵۰٬۰۰۰ تومان" },
      { name: "اشتراک شش‌ماهه", value: 1900000, formattedValue: "۱٬۹۰۰٬۰۰۰ تومان" },
      { name: "اشتراک سالانه", value: 4700000, formattedValue: "۴٬۷۰۰٬۰۰۰ تومان" }
    ]
  },
  'chatgpt': {
    id: 'chatgpt',
    title: 'چت جی‌پی‌تی',
    options: [
      { name: "پلن پلاس", value: 2125000, formattedValue: "۲,۱۲۵,۰۰۰ تومان" },
      { name: "پلن پرو", value: 17460000, formattedValue: "۱۷٬۴۶۷,۰۰۰ تومان" }
    ]
  }
};

const ArticleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: string}>({});
  const [addedToCart, setAddedToCart]= useState<{[key: string]: boolean}>({});
  const [userFeedback, setUserFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);
  const { addToCart } = useShoppingCart();
  const { showError } = useNotificationContext();
  
  const article = articles.find(a => a.slug === slug);
  
  // SEO optimization
  useSEO({
    title: article ? `${article.title} | سای جی` : 'مقاله یافت نشد | سای جی',
    description: article?.metaDescription || article?.excerpt || 'مقاله آموزشی در سای جی',
    keywords: article?.keywords || [],
    ogImage: article?.imageUrl,
    canonicalUrl: `https://psygstore.com/articles/${slug}`,
    structuredData: article ? {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": article.title,
      "description": article.excerpt,
      "image": article.imageUrl,
      "author": {
        "@type": "Organization",
        "name": "سای جی"
      },
      "publisher": {
        "@type": "Organization",
        "name": "سای جی",
        "logo": {
          "@type": "ImageObject",
          "url": "https://psygstore.com/logo.png"
        }
      },
      "datePublished": article.date,
      "dateModified": article.date,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://psygstore.com/articles/${article.slug}`
      }
    } : undefined
  });
  
  if (!article) {
    return <Navigate to="/articles" replace />;
  }

  // Determine related products based on article category/keywords
  const getRelatedProducts = () => {
    const relatedProducts = [];
    
    if (article.category === 'تلگرام' || article.keywords.some(k => k.includes('تلگرام'))) {
      relatedProducts.push('telegram-premium');
    }
    if (article.category === 'اسپاتیفای' || article.keywords.some(k => k.includes('اسپاتیفای'))) {
      relatedProducts.push('spotify');
    }
    if (article.category === 'هوش مصنوعی' || article.keywords.some(k => k.includes('چت جی پی تی') || k.includes('ChatGPT'))) {
      relatedProducts.push('chatgpt');
    }
    
    return relatedProducts;
  };

  const relatedProducts = getRelatedProducts();

  const handleProductOptionSelect = (productId: string, optionName: string) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: optionName
    }));
  };

  const handleAddToCart = (productId: string) => {
    const selectedOption = selectedProducts[productId];
    if (!selectedOption) {
      showError(
        'گزینه انتخاب نشده',
        'لطفاً یک گزینه اشتراک انتخاب کنید.',
        { duration: 3000 }
      );
      return;
    }

    const product = productData[productId];
    const option = product.options.find(opt => opt.name === selectedOption);
    
    if (option) {
      addToCart({
        id: productId,
        title: product.title,
        option: option.name,
        price: option.value
      });

      // Show success feedback
      setAddedToCart(prev => ({ ...prev, [productId]: true }));
      setTimeout(() => {
        setAddedToCart(prev => ({ ...prev, [productId]: false }));
      }, 2000);
    }
  };

  const handleFeedback = (type: 'helpful' | 'not-helpful') => {
    setUserFeedback(type);
    setShowFeedbackThanks(true);
    setTimeout(() => setShowFeedbackThanks(false), 3000);
  };

  const formatContent = (content: string) => {
    // Convert markdown-like content to HTML
    return content
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-[#39ff14] mb-6 mt-8">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-white mb-4 mt-6">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-[#39ff14] mb-3 mt-4">$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4 class="text-lg font-semibold text-white mb-2 mt-3">$1</h4>')
      .replace(/\*\*(.*?)\*\*/gm, '<strong class="font-bold text-[#39ff14]">$1</strong>')
      .replace(/\*(.*?)$/gm, '<li class="text-gray-300 mb-1">$1</li>')
      .replace(/^- (.*$)/gm, '<li class="text-gray-300 mb-1 mr-4">&bull; $1</li>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/60 border border-[#39ff14]/30 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-[#39ff14] text-sm">$1</code></pre>')
      .replace(/`(.*?)`/g, '<code class="bg-black/40 text-[#39ff14] px-2 py-1 rounded text-sm">$1</code>')
      .replace(/\n\n/g, '</p><p class="text-gray-300 mb-4 leading-relaxed">')
      .replace(/\n/g, '<br>');
  };

  const shareArticle = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt,
          url: window.location.href,
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="min-h-screen text-white rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Header />
        
        <main className="mt-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6" aria-label="breadcrumb">
            <a href="/" className="hover:text-[#39ff14] transition-colors">خانه</a>
            <ArrowRight className="w-4 h-4" />
            <a href="/articles" className="hover:text-[#39ff14] transition-colors">مقالات</a>
            <ArrowRight className="w-4 h-4" />
            <span className="text-white">{article.title}</span>
          </nav>

          {/* Article Header */}
          <article className="bg-black/40 backdrop-blur-xl rounded-2xl border border-[#39ff14]/20 overflow-hidden">
            {/* Hero Image */}
            <div className="relative h-64 md:h-80 overflow-hidden">
              <LazyImage 
                src={article.imageUrl} 
                alt={article.title}
                className="w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              {/* Article Meta Overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <span className="bg-[#39ff14] text-black text-sm font-semibold px-3 py-1 rounded-full">
                    {article.category}
                  </span>
                  <div className="flex items-center text-white text-sm">
                    <Calendar className="w-4 h-4 ml-1" />
                    <time dateTime={article.date}>{article.date}</time>
                  </div>
                  <div className="flex items-center text-white text-sm">
                    <Clock className="w-4 h-4 ml-1" />
                    {article.readTime} دقیقه مطالعه
                  </div>
                </div>
              </div>
            </div>

            {/* Article Content */}
            <div className="p-6 md:p-8">
              {/* Title and Actions */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {article.title}
                </h1>
                <button
                  onClick={shareArticle}
                  className="flex items-center gap-2 bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] px-4 py-2 rounded-lg hover:bg-[#39ff14]/20 transition-all self-start"
                  aria-label="اشتراک‌گذاری مقاله"
                >
                  <Share2 className="w-4 h-4" />
                  اشتراک‌گذاری
                </button>
              </div>

              {/* Excerpt */}
              <div className="bg-[#39ff14]/10 border border-[#39ff14]/30 rounded-xl p-4 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-[#39ff14]" />
                  <span className="text-[#39ff14] font-semibold">خلاصه مقاله</span>
                </div>
                <p className="text-gray-300 leading-relaxed">{article.excerpt}</p>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap items-center gap-2 mb-8">
                <Tag className="w-4 h-4 text-[#39ff14]" />
                <span className="text-[#39ff14] text-sm font-semibold">کلمات کلیدی:</span>
                {article.keywords.map((keyword, index) => (
                  <span 
                    key={index}
                    className="bg-black/40 border border-[#39ff14]/30 text-gray-300 text-sm px-3 py-1 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              {/* Related Products Purchase Section */}
              {relatedProducts.length > 0 && (
                <div className="mb-8 p-6 bg-gradient-to-r from-[#39ff14]/10 to-[#004d00]/10 border border-[#39ff14]/30 rounded-xl">
                  <h3 className="text-xl font-bold text-[#39ff14] mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    خرید سرویس‌های مرتبط
                  </h3>
                  <p className="text-gray-300 mb-6">
                    برای استفاده از امکانات مطرح شده در این مقاله، می‌توانید سرویس‌های زیر را خریداری کنید:
                  </p>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {relatedProducts.map(productId => {
                      const product = productData[productId];
                      const selectedOption = selectedProducts[productId];
                      const isAdded = addedToCart[productId];
                      
                      return (
                        <div key={productId} className="bg-black/40 border border-[#39ff14]/20 rounded-xl p-5">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 text-[#39ff14]">
                              <ProductIcon productId={productId} className="w-full h-full" />
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-lg">{product.title}</h4>
                              <p className="text-gray-400 text-sm">انتخاب پلن مورد نظر:</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {product.options.map((option, index) => (
                              <button
                                key={index}
                                onClick={() => handleProductOptionSelect(productId, option.name)}
                                className={`p-3 rounded-lg border transition-all text-right ${
                                  selectedOption === option.name
                                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                                    : 'bg-black/30 border-[#39ff14]/20 text-gray-300 hover:border-[#39ff14]/50'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">{option.name}</span>
                                  <span className="font-semibold">{option.formattedValue}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => handleAddToCart(productId)}
                            disabled={!selectedOption || isAdded}
                            className={`w-full py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                              isAdded
                                ? 'bg-green-600 text-white cursor-default'
                                : selectedOption
                                ? 'bg-gradient-to-r from-[#004d00] to-[#39ff14] text-black hover:shadow-[0_0_15px_rgba(57,255,20,0.4)]'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-5 h-5" />
                                اضافه شد به سبد خرید
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-5 h-5" />
                                افزودن به سبد خرید
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Article Content */}
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: `<p class="text-gray-300 mb-4 leading-relaxed">${formatContent(article.content)}</p>` 
                }}
              />

              {/* Article Feedback Section */}
              <div className="mt-12 p-6 bg-gradient-to-br from-[#39ff14]/10 via-[#004d00]/10 to-black/20 border border-[#39ff14]/30 rounded-xl relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#39ff14]/5 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#004d00]/10 rounded-full blur-xl"></div>
                
                <div className="relative z-10">
                  {!showFeedbackThanks ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-[#39ff14]/20 rounded-full flex items-center justify-center">
                          <Star className="w-5 h-5 text-[#39ff14]" />
                        </div>
                        <h3 className="text-xl font-bold text-white">آیا این مقاله مفید بود؟</h3>
                      </div>
                      
                      <p className="text-gray-300 mb-6 leading-relaxed">
                        نظر شما برای ما ارزشمند است و به بهبود کیفیت محتوا کمک می‌کند. 
                        همچنین برای دسترسی به سرویس‌های معرفی شده با بهترین قیمت و پشتیبانی کامل، از ما خرید کنید.
                      </p>

                      {/* Feedback Buttons */}
                      <div className="flex flex-wrap gap-4 mb-6">
                        <button
                          onClick={() => handleFeedback('helpful')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                            userFeedback === 'helpful'
                              ? 'bg-green-600 border-green-500 text-white'
                              : 'bg-black/30 border-[#39ff14]/30 text-[#39ff14] hover:bg-[#39ff14]/10'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          مفید بود
                        </button>
                        
                        <button
                          onClick={() => handleFeedback('not-helpful')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                            userFeedback === 'not-helpful'
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-black/30 border-gray-600 text-gray-400 hover:bg-gray-600/10'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          نیاز به بهبود
                        </button>
                      </div>

                      {/* Service Benefits */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-[#39ff14]/20">
                          <Zap className="w-5 h-5 text-[#39ff14]" />
                          <span className="text-white text-sm">فعال‌سازی آنی</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-[#39ff14]/20">
                          <Shield className="w-5 h-5 text-[#39ff14]" />
                          <span className="text-white text-sm">گارانتی کیفیت</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-[#39ff14]/20">
                          <Award className="w-5 h-5 text-[#39ff14]" />
                          <span className="text-white text-sm">بهترین قیمت</span>
                        </div>
                      </div>

                      {/* Quick Purchase Buttons */}
                      <div className="flex flex-wrap gap-3">
                        {relatedProducts.map(productId => {
                          const product = productData[productId];
                          return (
                            <a 
                              key={productId}
                              href={`/#${productId}`}
                              className="flex items-center gap-2 bg-gradient-to-r from-[#004d00] to-[#39ff14] text-black px-4 py-2 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all text-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                              خرید {product.title}
                            </a>
                          );
                        })}
                        
                        <a 
                          href="https://t.me/Psygsupport"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-black/40 border border-[#39ff14]/30 text-[#39ff14] px-4 py-2 rounded-lg hover:bg-[#39ff14]/10 transition-all text-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          پشتیبانی آنلاین
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#39ff14]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-[#39ff14]" />
                      </div>
                      <h3 className="text-xl font-bold text-[#39ff14] mb-2">متشکریم از نظر شما!</h3>
                      <p className="text-gray-300">
                        بازخورد شما برای ما ارزشمند است و به بهبود کیفیت محتوا کمک می‌کند.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>

          {/* Related Articles */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-[#39ff14] mb-6">مقالات مرتبط</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {articles
                .filter(a => a.slug !== article.slug && a.category === article.category)
                .slice(0, 2)
                .map(relatedArticle => (
                  <a
                    key={relatedArticle.id}
                    href={`/articles/${relatedArticle.slug}`}
                    className="block bg-black/40 backdrop-blur-xl rounded-xl border border-[#39ff14]/20 overflow-hidden hover:border-[#39ff14]/50 transition-all duration-300 hover:translate-y-[-2px] group"
                  >
                    <div className="relative h-32 overflow-hidden">
                      <LazyImage 
                        src={relatedArticle.imageUrl} 
                        alt={relatedArticle.title}
                        className="w-full h-full transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold mb-2 group-hover:text-[#39ff14] transition-colors line-clamp-2">
                        {relatedArticle.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <time dateTime={relatedArticle.date}>{relatedArticle.date}</time>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {relatedArticle.readTime} دقیقه
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
            </div>
          </section>
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

export default ArticleDetailPage;
