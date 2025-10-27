import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { useNotificationContext } from '../context/NotificationContext';
import ProductIcon from './ProductIcon';
import CartSummary from './CartSummary';
import CheckoutFlow from './CheckoutFlow';

interface ShoppingCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShoppingCartModal: React.FC<ShoppingCartModalProps> = ({ isOpen, onClose }) => {
  const { cartItems, increaseQuantity, decreaseQuantity, removeFromCart } = useShoppingCart();
  const { showSuccess } = useNotificationContext();
  const [currentView, setCurrentView] = useState<'cart' | 'checkout'>('cart');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentView('cart');
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Listen for cart open events
  useEffect(() => {
    const handleOpenCart = () => {
      if (!isOpen) {
        // This would be handled by the parent component
      }
    };

    document.addEventListener('openCart', handleOpenCart);
    return () => document.removeEventListener('openCart', handleOpenCart);
  }, [isOpen]);

  const handleCheckout = () => {
    setCurrentView('checkout');
  };

  const handleCheckoutComplete = () => {
    setCurrentView('cart');
    onClose();
  };

  const handleBackToCart = () => {
    setCurrentView('cart');
  };

  const handleRemoveItem = (id: string, option: string, title: string) => {
    removeFromCart(id, option);
    showSuccess(
      'محصول حذف شد',
      `${title} از سبد خرید حذف شد`,
      { duration: 3000 }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto flex items-start justify-center pt-10 pb-10">
      <div className="bg-[#111] rounded-2xl border border-[#39ff14] w-full max-w-5xl mx-4 shadow-lg animate-modal-in">
        <div className="relative p-6">
          {/* Header - Only show close button, CheckoutFlow handles its own header */}
          {currentView === 'cart' && (
            <div className="flex items-center justify-between mb-6">
              <div></div>
              <h2 className="text-2xl font-bold text-white text-center flex-1">سبد خرید شما</h2>
              <button 
                onClick={onClose}
                className="text-[#39ff14] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Close button for checkout view */}
          {currentView === 'checkout' && (
            <div className="absolute top-6 left-6 z-10">
              <button 
                onClick={onClose}
                className="text-[#39ff14] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {currentView === 'cart' ? (
            <>
              {cartItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-lg mb-2">سبد خرید شما خالی است</p>
                  <p className="text-gray-500 text-sm">محصولات مورد نظر خود را اضافه کنید</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Cart Items */}
                  <div className="lg:col-span-2">
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 modal-scrollbar">
                      {cartItems.map((item) => (
                        <div key={`${item.id}-${item.option}`} className="bg-black/40 rounded-xl p-5 border border-[#39ff14]/20 hover:border-[#39ff14]/40 transition-all">
                          <div className="flex items-start gap-4">
                            {/* Product Icon */}
                            <div className="w-16 h-16 bg-[#39ff14]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <ProductIcon productId={item.id} className="w-10 h-10" />
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[#39ff14] font-bold text-lg mb-1">{item.title}</h3>
                              <p className="text-white text-sm mb-2">{item.option}</p>
                              <p className="text-gray-400 text-xs">
                                قیمت واحد: {item.price.toLocaleString()} تومان
                              </p>
                            </div>
                            
                            {/* Quantity Controls */}
                            <div className="flex flex-col items-end gap-3">
                              <div className="flex items-center gap-2 bg-black/50 rounded-lg p-1">
                                <button 
                                  onClick={() => decreaseQuantity(item.id, item.option)}
                                  className="w-8 h-8 bg-red-600 text-white rounded flex items-center justify-center hover:bg-red-700 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="mx-3 text-white font-semibold min-w-[2rem] text-center">
                                  {item.quantity}
                                </span>
                                <button 
                                  onClick={() => increaseQuantity(item.id, item.option)}
                                  className="w-8 h-8 bg-[#39ff14] text-black rounded flex items-center justify-center hover:bg-white transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              
                              {/* Price and Remove */}
                              <div className="text-right">
                                <p className="text-white font-bold text-lg">
                                  {(item.price * item.quantity).toLocaleString()} تومان
                                </p>
                                <button
                                  onClick={() => handleRemoveItem(item.id, item.option, item.title)}
                                  className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors text-sm mt-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Cart Summary */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-0">
                      <CartSummary 
                        onCheckout={handleCheckout}
                        isProcessing={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <CheckoutFlow 
              onComplete={handleCheckoutComplete}
              onBack={handleBackToCart}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingCartModal;