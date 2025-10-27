import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import LEDBoard from '../components/LEDBoard';
import ProductCard from '../components/ProductCard';
import ArticlePreview from '../components/ArticlePreview';
import Footer from '../components/Footer';
import ShoppingCartBubble from '../components/ShoppingCartBubble';
import DashboardBubble from '../components/DashboardBubble';
import MobileNavBar from '../components/MobileNavBar';
import ShoppingCartModal from '../components/ShoppingCartModal';
import DashboardModal from '../components/DashboardModal';
import ProductIcon from '../components/ProductIcon';
import { useSEO } from '../hooks/useSEO';
import { articles } from '../data/articles';

const HomePage: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  // Get featured articles (first 2)
  const featuredArticles = articles.slice(0, 2);

  // SEO optimization for home page
  useSEO({
    title: 'سای جی | مرجع خرید آسان سرویس‌های آنلاین',
    description: 'تهیه آسان و سریع انواع سرویس‌های آنلاین از جمله تلگرام پریمیوم، اسپاتیفای و چت جی‌پی‌تی با قیمت‌های مناسب و پشتیبانی ۲۴ ساعته',
    keywords: ['خرید تلگرام پریمیوم', 'اسپاتیفای', 'چت جی پی تی', 'سرویس های آنلاین', 'اشتراک ارزان'],
    canonicalUrl: 'https://psygstore.com',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "سای جی",
      "url": "https://psygstore.com",
      "description": "مرجع خرید آسان سرویس‌های آنلاین",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://psygstore.com/articles?search={search_term_string}",
        "query-input": "required name=search_term_string"
      },
      "offers": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Product",
            "name": "تلگرام پریمیوم",
            "description": "اشتراک تلگرام پریمیوم با امکانات ویژه"
          },
          "price": "795000",
          "priceCurrency": "IRR"
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Product",
            "name": "اسپاتیفای",
            "description": "اشتراک موسیقی اسپاتیفای"
          },
          "price": "510000",
          "priceCurrency": "IRR"
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Product",
            "name": "چت جی‌پی‌تی",
            "description": "اشتراک هوش مصنوعی چت جی‌پی‌تی"
          },
          "price": "2125000",
          "priceCurrency": "IRR"
        }
      ]
    }
  });

  // Listen for custom events to open modals
  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    const handleOpenDashboard = () => setIsDashboardOpen(true);

    document.addEventListener('openCart', handleOpenCart);
    document.addEventListener('openDashboard', handleOpenDashboard);

    return () => {
      document.removeEventListener('openCart', handleOpenCart);
      document.removeEventListener('openDashboard', handleOpenDashboard);
    };
  }, []);

  return (
    <div className="min-h-screen text-white rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Header />
        <LEDBoard />
        
        <main className="mt-12">
          <section>
            <div className="grid grid-cols-1 gap-6">
              <div id="chatgpt">
                <ProductCard 
                  id="chatgpt"
                  title="چت جی‌پی‌تی"
                  options={[
                    { name: "پلن پلاس", value: 2125000, formattedValue: "۲,۱۲۵,۰۰۰ تومان" },
                    { name: "پلن پرو", value: 17460000, formattedValue: "۱۷٬۴۶۷,۰۰۰ تومان" }
                  ]}
                  icon={<ProductIcon productId="chatgpt" className="w-10 h-10" />}
                  articleLink="/articles/chatgpt-advanced-prompts"
                />
              </div>
              
              <div id="spotify">
                <ProductCard 
                  id="spotify"
                  title="اسپاتیفای"
                  options={[
                    { name: "اشتراک ماهانه", value: 510000, formattedValue: "۵۱۰٬۰۰۰ تومان" },
                    { name: "اشتراک دوماهه", value: 893000, formattedValue: "۸۹۳٬۰۰۰ تومان" },
                    { name: "اشتراک سه‌ماهه", value: 1115000, formattedValue: "۱٬۱۵۰٬۰۰۰ تومان" },
                    { name: "اشتراک شش‌ماهه", value: 1900000, formattedValue: "۱٬۹۰۰٬۰۰۰ تومان" },
                    { name: "اشتراک سالانه", value: 4700000, formattedValue: "۴٬۷۰۰٬۰۰۰ تومان" }
                  ]}
                  icon={<ProductIcon productId="spotify" className="w-10 h-10" />}
                  articleLink="/articles/spotify-playlist-optimization"
                />
              </div>
              
              <div id="telegram-premium">
                <ProductCard 
                  id="telegram-premium"
                  title="تلگرام پریمیوم"
                  options={[
                    { name: "اشتراک ماهانه", value: 795000, formattedValue: "۷۹۵,۰۰۰ تومان" },
                    { name: "اشتراک سه‌ماهه", value: 1246000, formattedValue: "۱٬۲۴۶٬۰۰۰ تومان" },
                    { name: "اشتراک شش‌ماهه", value: 1728000, formattedValue: "۱٬۷۲۸٬۰۰۰ تومان" },
                    { name: "اشتراک سالانه", value: 3200000, formattedValue: "۳٬۲۰۰٬۰۰۰ تومان" }
                  ]}
                  icon={<ProductIcon productId="telegram-premium" className="w-10 h-10" />}
                  articleLink="/articles/telegram-premium-guide"
                />
              </div>
            </div>
          </section>
          
          <section className="mt-20">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-[#39ff14]">مقالات آموزشی</h2>
              <a href="/articles" className="text-white hover:text-[#39ff14] transition-colors text-sm">
                مشاهده همه مقالات
              </a>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredArticles.map(article => (
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
          </section>
        </main>
        
        <Footer />
      </div>
      
      {/* Desktop Bubbles */}
      <div className="hidden md:block">
        <ShoppingCartBubble onClick={() => setIsCartOpen(true)} />
        <DashboardBubble onClick={() => setIsDashboardOpen(true)} />
      </div>
      
      {/* Mobile Navigation - Now completely at bottom */}
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

export default HomePage;