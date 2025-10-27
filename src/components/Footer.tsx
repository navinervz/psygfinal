import React from 'react';
import { Instagram, MessageCircle, Heart, Sparkles, Shield, Award } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-20 py-12 px-6 glass-strong rounded-3xl relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#39ff14]/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#39ff14]/3 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#39ff14]/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + (i % 3)}s`
            }}
          />
        ))}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="glass-neon rounded-xl p-2">
              <Sparkles className="w-6 h-6 text-[#39ff14]" />
            </div>
            <h3 className="text-lg font-bold text-[#39ff14]">
              درباره <span className="font-aghasem">سای جی</span>
            </h3>
          </div>
          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            سای جی، مرجع خرید آسان سرویس‌های آنلاین، با ارائه خدمات متنوع و پشتیبانی 24 ساعته در خدمت شماست.
          </p>
          <div className="flex space-x-4 rtl:space-x-reverse">
            <a 
              href="https://www.instagram.com/psygstore" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="glass rounded-xl p-3 text-white hover:text-[#39ff14] hover:glass-neon transition-all duration-300 group"
            >
              <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            </a>
            <a 
              href="https://t.me/Psygsupport" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="glass rounded-xl p-3 text-white hover:text-[#39ff14] hover:glass-neon transition-all duration-300 group"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-[#39ff14] mb-6 flex items-center gap-2">
            <div className="glass-neon rounded-lg p-1">
              <Award className="w-5 h-5" />
            </div>
            لینک‌های سریع
          </h3>
          <ul className="space-y-3">
            <li>
              <a 
                href="/articles" 
                className="text-gray-300 hover:text-[#39ff14] transition-colors text-sm flex items-center gap-2 group"
              >
                <div className="w-1 h-1 bg-[#39ff14]/50 rounded-full group-hover:bg-[#39ff14] transition-colors"></div>
                مقالات آموزشی
              </a>
            </li>
            <li>
              <a 
                href="/faq" 
                className="text-gray-300 hover:text-[#39ff14] transition-colors text-sm flex items-center gap-2 group"
              >
                <div className="w-1 h-1 bg-[#39ff14]/50 rounded-full group-hover:bg-[#39ff14] transition-colors"></div>
                سوالات متداول
              </a>
            </li>
            <li>
              <a 
                href="/contact" 
                className="text-gray-300 hover:text-[#39ff14] transition-colors text-sm flex items-center gap-2 group"
              >
                <div className="w-1 h-1 bg-[#39ff14]/50 rounded-full group-hover:bg-[#39ff14] transition-colors"></div>
                تماس با ما
              </a>
            </li>
            <li>
              <a 
                href="/terms" 
                className="text-gray-300 hover:text-[#39ff14] transition-colors text-sm flex items-center gap-2 group"
              >
                <div className="w-1 h-1 bg-[#39ff14]/50 rounded-full group-hover:bg-[#39ff14] transition-colors"></div>
                قوانین و مقررات
              </a>
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-[#39ff14] mb-6 flex items-center gap-2">
            <div className="glass-neon rounded-lg p-1">
              <Shield className="w-5 h-5" />
            </div>
            پشتیبانی
          </h3>
          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            پشتیبانی 24 ساعته، 7 روز هفته از طریق تلگرام
          </p>
          <a 
            href="https://t.me/Psygsupport" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center bg-gradient-to-r from-[#39ff14] to-[#00ff00] text-black rounded-2xl py-3 px-6 font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(57,255,20,0.6)] shadow-[0_0_15px_rgba(57,255,20,0.3)] group relative overflow-hidden"
          >
            {/* Button shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            
            <MessageCircle className="w-5 h-5 ml-2 text-black group-hover:scale-110 transition-transform duration-300 relative z-10" />
            <span className="text-black relative z-10">پشتیبانی آنلاین</span>
          </a>
        </div>
      </div>
      
      <div className="mt-12 pt-8 border-t border-[#39ff14]/20 text-center relative z-10">
        <p className="text-gray-400 text-sm flex items-center justify-center flex-wrap gap-2">
          ساخته شده با 
          <Heart className="w-4 h-4 mx-1 text-red-500 animate-pulse" /> 
          توسط تیم 
          <span className="font-aghasem mx-1 text-[#39ff14] font-bold">سای جی</span> 
          - تمامی حقوق محفوظ است © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
};

export default Footer;