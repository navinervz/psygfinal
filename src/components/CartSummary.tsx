import React from 'react';
import { ShoppingCart, Wallet, CreditCard, Zap } from 'lucide-react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { useAuth } from '../context/AuthContext';

interface CartSummaryProps {
  onCheckout: () => void;
  isProcessing?: boolean;
}

const CartSummary: React.FC<CartSummaryProps> = ({ onCheckout, isProcessing = false }) => {
  const { cartItems, calculateTotal } = useShoppingCart();
  const { user } = useAuth();

  const total = calculateTotal();
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const walletBalance = user?.walletBalanceRial ?? 0;
  const canPayWithWallet = walletBalance >= total;

  if (cartItems.length === 0) {
    return (
      <div className="bg-black/30 rounded-xl p-6 border border-slate-800 text-center">
        <ShoppingCart className="w-10 h-10 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-300 text-sm">Your cart is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Order Summary</h3>
          <p className="text-slate-400 text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''} in your cart</p>
        </div>
      </header>

      <div className="space-y-3">
        {cartItems.map((item) => (
          <div key={`${item.id}-${item.option}`} className="flex justify-between items-center p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.option}</p>
              <p className="text-xs text-emerald-400">Qty: {item.quantity}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{(item.price * item.quantity).toLocaleString('fa-IR')} تومان</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white text-base font-semibold">Total</span>
          <span className="text-xl font-bold text-emerald-400">{total.toLocaleString('fa-IR')} تومان</span>
        </div>

        {user && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Wallet balance</span>
              <span className="font-semibold">{walletBalance.toLocaleString('fa-IR')} تومان</span>
            </div>
            {canPayWithWallet ? (
              <p className="mt-2 flex items-center gap-2 text-emerald-400 text-xs"><Zap className="w-3 h-3" /> You can complete this order using your wallet balance.</p>
            ) : (
              <p className="mt-2 text-xs text-amber-400">Shortfall: {(total - walletBalance).toLocaleString('fa-IR')} تومان</p>
            )}
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-200">
          <p className="text-xs text-slate-300 mb-1">Recommended payment method:</p>
          {canPayWithWallet ? (
            <p className="flex items-center gap-2 text-emerald-300 text-sm"><Wallet className="w-4 h-4" /> Pay directly with wallet</p>
          ) : (
            <p className="flex items-center gap-2 text-indigo-300 text-sm"><CreditCard className="w-4 h-4" /> Top up wallet or pay with card/crypto</p>
          )}
        </div>

        <button
          onClick={onCheckout}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-emerald-950 font-semibold py-3 rounded-lg hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing…' : 'Proceed to checkout'}
        </button>
      </div>
    </div>
  );
};

export default CartSummary;
