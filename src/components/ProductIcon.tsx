import React from 'react';

interface ProductIconProps {
  productId: string;
  className?: string;
}

const ProductIcon: React.FC<ProductIconProps> = ({ productId, className = "w-full h-full" }) => {
  const getIconSrc = () => {
    switch (productId) {
      case 'telegram-premium':
        return '/telegram-icon.svg';
      case 'chatgpt':
        return '/chatgpt-icon.svg';
      case 'spotify':
        return '/spotify-icon.svg';
      default:
        return '/telegram-icon.svg'; // fallback
    }
  };

  const getIconSize = () => {
    switch (productId) {
      case 'telegram-premium':
        return { width: '40px', height: '40px' }; // بزرگ‌تر از قبل
      case 'spotify':
        return { width: '34px', height: '34px' }; // +2px از 32px
      case 'chatgpt':
      default:
        return { width: '32px', height: '32px' }; // اندازه پایه
    }
  };

  const iconSize = getIconSize();

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div 
        className="flex items-center justify-center"
        style={{ 
          width: iconSize.width, 
          height: iconSize.height,
          minWidth: iconSize.width,
          minHeight: iconSize.height
        }}
      >
        <img 
          src={getIconSrc()} 
          alt={`${productId} icon`} 
          className="w-full h-full"
          style={{ 
            width: iconSize.width, 
            height: iconSize.height,
            objectFit: 'contain',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};

export default ProductIcon;