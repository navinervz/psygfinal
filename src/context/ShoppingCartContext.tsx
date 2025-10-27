import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotificationContext } from './NotificationContext';

export interface CartItem {
  id: string;
  title: string;
  option: string;
  price: number;
  quantity: number;
}

interface ShoppingCartContextProps {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string, option: string) => void;
  increaseQuantity: (id: string, option: string) => void;
  decreaseQuantity: (id: string, option: string) => void;
  calculateTotal: () => number;
  clearCart: () => void;
}

const ShoppingCartContext = createContext<ShoppingCartContextProps>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  increaseQuantity: () => {},
  decreaseQuantity: () => {},
  calculateTotal: () => 0,
  clearCart: () => {},
});

export const useShoppingCart = () => useContext(ShoppingCartContext);

export const ShoppingCartProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { showSuccess, showInfo } = useNotificationContext();

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(
        cartItem => cartItem.id === item.id && cartItem.option === item.option
      );

      if (existingItem) {
        showInfo(
          'محصول به‌روزرسانی شد',
          `تعداد ${item.title} در سبد خرید افزایش یافت`,
          { duration: 3000 }
        );
        return prevItems.map(cartItem => 
          cartItem.id === item.id && cartItem.option === item.option
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        showSuccess(
          'محصول اضافه شد!',
          `${item.title} با موفقیت به سبد خرید اضافه شد`,
          { 
            duration: 4000,
            action: {
              label: 'مشاهده سبد خرید',
              onClick: () => {
                // This will be handled by the component that uses this context
                document.dispatchEvent(new CustomEvent('openCart'));
              }
            }
          }
        );
        return [...prevItems, { ...item, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (id: string, option: string) => {
    setCartItems(prevItems => {
      const removedItem = prevItems.find(item => item.id === id && item.option === option);
      if (removedItem) {
        showInfo(
          'محصول حذف شد',
          `${removedItem.title} از سبد خرید حذف شد`,
          { duration: 3000 }
        );
      }
      return prevItems.filter(item => !(item.id === id && item.option === option));
    });
  };

  const increaseQuantity = (id: string, option: string) => {
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === id && item.option === option
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (id: string, option: string) => {
    setCartItems(prevItems => {
      const targetItem = prevItems.find(
        item => item.id === id && item.option === option
      );

      if (targetItem && targetItem.quantity > 1) {
        return prevItems.map(item => 
          item.id === id && item.option === option
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        if (targetItem) {
          showInfo(
            'محصول حذف شد',
            `${targetItem.title} از سبد خرید حذف شد`,
            { duration: 3000 }
          );
        }
        return prevItems.filter(item => !(item.id === id && item.option === option));
      }
    });
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const clearCart = () => {
    setCartItems([]);
    showSuccess(
      'سبد خرید پاک شد',
      'تمامی محصولات از سبد خرید حذف شدند',
      { duration: 3000 }
    );
  };

  return (
    <ShoppingCartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      calculateTotal,
      clearCart,
    }}>
      {children}
    </ShoppingCartContext.Provider>
  );
};