import React from 'react';
import { Home, FileText, HelpCircle, ShoppingCart, User } from 'lucide-react';
import { useShoppingCart } from '../context/ShoppingCartContext';

interface MobileNavBarProps {
  onCartClick: () => void;
  onDashboardClick: () => void;
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ onCartClick, onDashboardClick }) => {
  const { cartItems } = useShoppingCart();
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navItems = [
    {
      icon: Home,
      label: 'خانه',
      href: '/',
      onClick: null
    },
    {
      icon: FileText,
      label: 'مقالات',
      href: '/articles',
      onClick: null
    },
    {
      icon: ShoppingCart,
      label: 'سبد خرید',
      href: null,
      onClick: onCartClick,
      badge: totalItems > 0 ? totalItems : null
    },
    {
      icon: User,
      label: 'پنل کاربری',
      href: null,
      onClick: onDashboardClick
    },
    {
      icon: HelpCircle,
      label: 'راهنما',
      href: '/faq',
      onClick: null
    }
  ];

  const handleItemClick = (item: typeof navItems[0]) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Liquid Glass Container - Completely at bottom */}
      <div className="relative">
        {/* Enhanced liquid glass background with stronger blur like cards */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40 backdrop-blur-[50px] border-t-2 border-white/15"></div>
        
        {/* Liquid glass surface effect */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#39ff14]/60 via-[#39ff14]/90 to-[#39ff14]/60"></div>
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm"></div>
        
        {/* Floating liquid particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-[#39ff14]/30 rounded-full animate-float"
              style={{
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                left: `${5 + (i * 6)}%`,
                top: `${20 + Math.sin(i * 0.8) * 40}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${4 + (i % 4)}s`
              }}
            />
          ))}
        </div>
        
        {/* Liquid depth layers similar to cards */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#39ff14]/15 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-[#39ff14]/8"></div>
        
        {/* Navigation Items */}
        <div className="relative z-10 flex items-center justify-around py-4 px-3 safe-area-inset-bottom">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                className="group flex flex-col items-center justify-center p-2 min-w-[60px] relative transition-all duration-500 hover:scale-110 active:scale-95"
              >
                {/* Liquid glass icon container */}
                <div className="relative mb-1">
                  {/* Liquid glow effect */}
                  <div className="absolute inset-0 bg-[#39ff14]/40 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500 scale-125"></div>
                  
                  {/* Main liquid glass background - similar to cards */}
                  <div className="relative w-12 h-12 bg-white/8 backdrop-blur-[40px] rounded-2xl border border-white/15 flex items-center justify-center group-hover:bg-[#39ff14]/20 group-hover:border-[#39ff14]/50 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    {/* Inner liquid effects */}
                    <div className="absolute inset-1 bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-xl"></div>
                    <div className="absolute inset-1 bg-gradient-to-tl from-[#39ff14]/8 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <Icon className="w-6 h-6 text-gray-300 group-hover:text-[#39ff14] transition-all duration-500 relative z-10" />
                    
                    {/* Liquid badge for cart */}
                    {item.badge && (
                      <div className="absolute -top-2 -right-2 min-w-[22px] h-6 bg-gradient-to-br from-[#ff4757] via-[#e74c3c] to-[#c0392b] text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg border border-white/30 backdrop-blur-sm">
                        <span className="px-1 relative z-10">{item.badge}</span>
                        {/* Liquid pulsing effects */}
                        <div className="absolute inset-0 bg-[#ff4757] rounded-full animate-ping opacity-30"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-[#ff6b6b]/80 to-[#e74c3c]/60 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Liquid ripple effect */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-[#39ff14]/30 rounded-2xl scale-0 group-active:scale-100 transition-transform duration-300 ease-out"></div>
                  </div>
                </div>
                
                {/* Liquid glass label */}
                <span className="text-xs text-gray-400 group-hover:text-[#39ff14] transition-all duration-500 font-medium bg-white/5 backdrop-blur-[20px] px-3 py-1 rounded-xl border border-white/10 group-hover:border-[#39ff14]/30 group-hover:bg-[#39ff14]/10">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Bottom safe area for newer phones */}
        <div className="h-safe-area-inset-bottom bg-gradient-to-t from-black/90 to-transparent"></div>
      </div>
      
      {/* Ambient liquid glow effects */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-48 h-16 bg-[#39ff14]/20 blur-2xl -z-10"></div>
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-[#39ff14]/30 blur-xl -z-10"></div>
    </nav>
  );
};

export default MobileNavBar;