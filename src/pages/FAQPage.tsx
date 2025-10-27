import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ShoppingCartBubble from '../components/ShoppingCartBubble';
import DashboardBubble from '../components/DashboardBubble';
import MobileNavBar from '../components/MobileNavBar';
import ShoppingCartModal from '../components/ShoppingCartModal';
import DashboardModal from '../components/DashboardModal';
import { useSEO } from '../hooks/useSEO';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'نحوه خرید و فعال‌سازی سرویس‌ها چگونه است؟',
    answer: 'پس از انتخاب سرویس مورد نظر و افزودن به سبد خرید، می‌توانید با استفاده از کیف پول یا درگاه پرداخت، خرید خود را نهایی کنید. پس از تأیید پرداخت، سرویس شما به صورت خودکار فعال خواهد شد.'
  },
  {
    question: 'آیا امکان پرداخت با ارز دیجیتال وجود دارد؟',
    answer: 'بله، در حال حاضر پرداخت با USDT (تتر) بر بستر شبکه اتریوم و با کیف پول MetaMask پشتیبانی می‌شود. در آینده امکان خرید با سایر توکن‌های معتبر نیز اضافه خواهد شد. برای پرداخت کافیست کیف پول MetaMask خود را متصل کنید و گزینه پرداخت با USDT را انتخاب کنید.'
  },
  {
    question: 'مدت زمان فعال‌سازی سرویس‌ها چقدر است؟',
    answer: 'فعال‌سازی اکثر سرویس‌ها به صورت آنی و خودکار انجام می‌شود. در موارد خاص که نیاز به بررسی دستی باشد، حداکثر زمان فعال‌سازی ۲۴ ساعت خواهد بود.'
  },
  {
    question: 'در صورت بروز مشکل چگونه می‌توانم پشتیبانی دریافت کنم؟',
    answer: 'پشتیبانی ما به صورت ۲۴ ساعته از طریق تلگرام در دسترس است. همچنین می‌توانید از طریق ایمیل با ما در تماس باشید. معمولاً پاسخگویی در تلگرام کمتر از ۱۵ دقیقه است.'
  },
  {
    question: 'آیا امکان لغو سفارش و بازگشت وجه وجود دارد؟',
    answer: 'بله، در صورتی که سرویس فعال نشده باشد، می‌توانید سفارش خود را لغو کنید و وجه پرداختی به کیف پول شما بازگردانده خواهد شد. برای سرویس‌های فعال شده، شرایط خاص هر سرویس اعمال می‌شود.'
  },
  {
    question: 'نحوه شارژ و برداشت از کیف پول چگونه است؟',
    answer: 'شما می‌توانید از طریق درگاه بانکی یا واریز USDT (تتر) در شبکه اتریوم، کیف پول خود را شارژ کنید. برای شارژ با ارز دیجیتال، کافیست کیف پول MetaMask خود را متصل کنید. برای برداشت نیز کافیست درخواست برداشت ثبت کنید و مبلغ مورد نظر به حساب بانکی شما واریز خواهد شد.'
  },
  {
    question: 'آیا خرید سرویس‌ها نیاز به ثبت‌نام دارد؟',
    answer: 'بله، برای خرید و استفاده از سرویس‌ها نیاز به ثبت‌نام دارید. شما می‌توانید با ایمیل و رمز عبور یا با اتصال کیف پول MetaMask وارد شوید. این کار برای حفظ امنیت و پیگیری سفارشات شما ضروری است. ثبت‌نام رایگان است.'
  },
  {
    question: 'نحوه اتصال کیف پول MetaMask چگونه است؟',
    answer: 'برای اتصال کیف پول MetaMask، ابتدا اطمینان حاصل کنید که افزونه MetaMask در مرورگر شما نصب است. سپس در پنل کاربری، بخش "کیف پول Web3" را انتخاب کنید و روی "اتصال MetaMask" کلیک کنید. پس از تأیید در MetaMask، کیف پول شما متصل خواهد شد و می‌توانید با USDT پرداخت کنید.'
  }
];

const FAQPage: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [openFAQs, setOpenFAQs] = useState<number[]>([]);

  // SEO optimization
  useSEO({
    title: 'سوالات متداول | سای جی',
    description: 'پاسخ به سوالات متداول درباره خرید سرویس‌های آنلاین، پرداخت با ارز دیجیتال، فعال‌سازی اشتراک‌ها و پشتیبانی در سای جی',
    keywords: ['سوالات متداول', 'راهنمای خرید', 'پرداخت ارز دیجیتال', 'MetaMask', 'USDT', 'پشتیبانی'],
    canonicalUrl: 'https://psygstore.com/faq',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    }
  });

  const toggleFAQ = (index: number) => {
    setOpenFAQs(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="min-h-screen text-white rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Header />
        
        <main className="mt-12">
          <h1 className="text-3xl font-bold text-[#39ff14] text-center mb-8">سوالات متداول</h1>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-black/40 backdrop-blur-xl rounded-xl border border-[#39ff14]/20 overflow-hidden transition-all duration-300 hover:border-[#39ff14]/50"
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between text-right"
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={openFAQs.includes(index)}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-lg font-semibold text-white">{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-[#39ff14] transition-transform duration-300 ${
                      openFAQs.includes(index) ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                <div 
                  id={`faq-answer-${index}`}
                  className={`px-6 transition-all duration-300 ${
                    openFAQs.includes(index) ? 'py-4 border-t border-[#39ff14]/20' : 'max-h-0 overflow-hidden'
                  }`}
                >
                  <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
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

export default FAQPage;