import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useShoppingCart } from '../context/ShoppingCartContext';

interface Props {
  onClick: () => void;
}

const ShoppingCartBubble: React.FC<Props> = ({ onClick }) => {
  const { cartItems } = useShoppingCart();
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div 
      className="fixed bottom-24 right-6 w-[60px] h-[60px] bg-black/50 border-2 border-[#39ff14] rounded-full flex items-center justify-center cursor-pointer font-bold shadow-[0_0_15px_#39ff14] z-50 transition-transform hover:scale-110 animate-float"
      onClick={onClick}
    >
      <ShoppingCart className="w-6 h-6 text-[#39ff14]" />
      
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#e74c3c] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {totalItems}
        </span>
      )}
      
      <div className="absolute w-full h-full bg-[#39ff14]/30 rounded-full animate-pulse"></div>
      
      <div className="small-bubble-container absolute w-full h-full overflow-visible">
        {[...Array(3)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-3 h-3 bg-[#39ff14] rounded-full opacity-80 animate-float-up"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${80 + Math.random() * 20}%`,
              animationDelay: `${i * 0.3}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ShoppingCartBubble;