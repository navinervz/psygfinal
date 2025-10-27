import React, { useState } from 'react';
import { ShoppingCart, Sparkles, Zap } from 'lucide-react';
import { useShoppingCart } from '../context/ShoppingCartContext';

export interface PriceOption {
  name: string;
  value: number;
  formattedValue: string;
}

export interface ProductProps {
  id: string;
  title: string;
  options: PriceOption[];
  icon: React.ReactNode;
  articleLink: string;
}

const ProductCard: React.FC<ProductProps> = ({ id, title, options, icon, articleLink }) => {
  const [selectedOption, setSelectedOption] = useState<PriceOption | null>(null);
  const { addToCart } = useShoppingCart();

  const handleOptionClick = (option: PriceOption) => {
    setSelectedOption(option);
  };

  const handleAddToCart = () => {
    if (!selectedOption) {
      return;
    }

    addToCart({
      id,
      title,
      option: selectedOption.name,
      price: selectedOption.value
    });
  };

  return (
    <div className="glass-strong rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
      {/* Animated background elements */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#39ff14]/10 to-transparent rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-[#39ff14]/5 to-transparent rounded-full blur-xl group-hover:scale-110 transition-transform duration-700"></div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="glass-neon rounded-2xl p-2 md:p-3 group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
          <div>
            <h2 className="text-[#39ff14] text-xl md:text-2xl font-bold text-shadow-sm group-hover:text-shadow-neon transition-all duration-300">
              {title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-[#39ff14]/60" />
              <span className="text-gray-400 text-xs md:text-sm">سرویس پریمیوم</span>
            </div>
          </div>
        </div>
        
        <div className="glass rounded-full p-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <Zap className="w-4 h-4 md:w-5 md:h-5 text-[#39ff14]" />
        </div>
      </div>
      
      {/* Options */}
      <div className="mb-6 md:mb-8 space-y-3 md:space-y-4 relative z-10">
        {options.map((option, index) => (
          <div 
            key={index}
            className={`glass rounded-xl md:rounded-2xl p-4 md:p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] group/option ${
              selectedOption?.name === option.name 
                ? 'glass-neon border-[#39ff14]/40 shadow-[0_0_20px_rgba(57,255,20,0.2)]' 
                : 'hover:glass-strong'
            }`}
            onClick={() => handleOptionClick(option)}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full border-2 transition-all duration-300 ${
                  selectedOption?.name === option.name 
                    ? 'border-[#39ff14] bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.5)]' 
                    : 'border-gray-500 group-hover/option:border-[#39ff14]/50'
                }`}>
                  {selectedOption?.name === option.name && (
                    <div className="w-full h-full rounded-full bg-[#39ff14] animate-pulse"></div>
                  )}
                </div>
                <span className="text-white font-medium text-sm md:text-base group-hover/option:text-[#39ff14] transition-colors duration-300">
                  {option.name}
                </span>
              </div>
              
              <div className="glass-neon rounded-lg md:rounded-xl py-1.5 px-3 md:py-2 md:px-4 group-hover/option:scale-105 transition-transform duration-300">
                <span className="text-[#39ff14] font-bold text-shadow-sm text-sm md:text-base">
                  {option.formattedValue}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 relative z-10">
        <button 
          onClick={handleAddToCart}
          disabled={!selectedOption}
          className={`flex-1 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 font-bold transition-all duration-300 relative overflow-hidden group/btn ${
            selectedOption 
              ? 'bg-gradient-to-r from-[#39ff14] to-[#00ff00] text-black hover:scale-105 hover:shadow-[0_0_25px_rgba(57,255,20,0.6)] cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.3)]' 
              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
          }`}
        >
          {/* Button shimmer effect */}
          {selectedOption && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
          )}
          
          <div className="flex items-center justify-center gap-2 md:gap-3 relative z-10">
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:scale-110 transition-transform duration-300" />
            <span className="text-sm md:text-base">افزودن به سبد خرید</span>
          </div>
        </button>
        
        <a
          href={articleLink}
          className="flex-1 glass rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 font-bold text-center transition-all duration-300 hover:scale-105 hover:glass-strong group/link relative overflow-hidden border border-[#39ff14]/30 hover:border-[#39ff14]/60"
        >
          {/* Link shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#39ff14]/10 to-transparent -translate-x-full group-hover/link:translate-x-full transition-transform duration-700"></div>
          
          <span className="text-[#39ff14] group-hover/link:text-white transition-colors duration-300 relative z-10 text-sm md:text-base">
            راهنمای استفاده
          </span>
        </a>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#39ff14]/30 rounded-full animate-float opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              left: `${20 + (i * 15)}%`,
              top: `${30 + Math.sin(i) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 2)}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductCard;