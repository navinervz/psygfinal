import React, { useState } from 'react';
import { Wallet, CreditCard, Smartphone, CheckCircle, AlertTriangle, User, Mail, MessageSquare, Shield, Clock, Package, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { useNotificationContext } from '../context/NotificationContext';
import LoadingSpinner from './LoadingSpinner';
import USDTPayment from './USDTPayment';
import Payment4Gateway from './Payment4Gateway';
import TonPayment from './TonPayment';
import ZarinPalPayment from './ZarinPalPayment';

interface CheckoutFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ onComplete, onBack }) => {
  const { user, topUpWallet } = useAuth();
  const { cartItems, calculateTotal, clearCart } = useShoppingCart();
  const { showSuccess, showError, showInfo } = useNotificationContext();
  
  const [currentStep, setCurrentStep] = useState<'customer-info' | 'payment-method' | 'wallet-topup' | 'processing' | 'complete'>('customer-info');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'wallet' | 'topup-rial' | 'topup-crypto'>('wallet');
  const [cryptoGateway, setCryptoGateway] = useState<'metamask' | 'payment4' | 'tonkeeper'>('payment4');
  const [customerInfo, setCustomerInfo] = useState({
    email: user?.email || '',
    telegramId: '',
    fullName: user?.full_name || ''
  });

  const total = calculateTotal();
  const canAffordWithWallet = user ? user.wallet_balance_rial >= total : false;
  const shortfall = user ? Math.max(0, total - user.wallet_balance_rial) : total;
  const hasTelegramProduct = cartItems.some(item => item.id === 'telegram-premium');

  const validateCustomerInfo = () => {
    if (!customerInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      showError('ایمیل نامعتبر', 'لطفاً یک ایمیل معتبر وارد کنید');
      return false;
    }

    if (!customerInfo.fullName.trim()) {
      showError('نام الزامی', 'لطفاً نام کامل خود را وارد کنید');
      return false;
    }

    if (hasTelegramProduct && !customerInfo.telegramId.trim()) {
      showError('شناسه تلگرام الزامی', 'برای خرید تلگرام پریمیوم، وارد کردن شناسه تلگرام الزامی است');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 'customer-info') {
      if (validateCustomerInfo()) {
        setCurrentStep('payment-method');
      }
    }
  };

  const handlePaymentMethodSelect = (method: 'wallet' | 'topup-rial' | 'topup-crypto') => {
    setSelectedPaymentMethod(method);
    
    if (method === 'wallet' && canAffordWithWallet) {
      setCurrentStep('processing');
      processOrder();
    } else if (method !== 'wallet') {
      setCurrentStep('wallet-topup');
    }
  };

  const processOrder = async () => {
    if (!user) {
      showError('خطا', 'لطفاً ابتدا وارد حساب کاربری خود شوید');
      return;
    }

    
    try {
      showInfo('در حال پردازش سفارش...', 'لطفاً صبر کنید', { duration: 2000 });
      
      // Simulate order processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Deduct from wallet if paying with wallet
      if (selectedPaymentMethod === 'wallet') {
        await topUpWallet(-total, 'rial'); // Negative amount for deduction
      }
      
      clearCart();
      setCurrentStep('complete');
      
      showSuccess(
        'سفارش ثبت شد!',
        'سفارش شما با موفقیت ثبت شد و به زودی پردازش خواهد شد',
        { duration: 6000 }
      );
      
      setTimeout(() => {
        onComplete();
      }, 4000);
      
    } catch (error) {
      showError('خطا در ثبت سفارش', 'مشکلی در ثبت سفارش رخ داد. لطفاً مجدداً تلاش کنید');
    }
  };

  const handleTopUpSuccess = async () => {
    showSuccess('شارژ موفق!', 'کیف پول شما با موفقیت شارژ شد');
    setCurrentStep('processing');
    await processOrder();
  };

  // Step indicator
  const steps = [
    { id: 'customer-info', title: 'اطلاعات مشتری', icon: User },
    { id: 'payment-method', title: 'روش پرداخت', icon: CreditCard },
    { id: 'processing', title: 'پردازش', icon: Clock },
    { id: 'complete', title: 'تکمیل', icon: CheckCircle }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  if (currentStep === 'complete') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div></div>
          <h2 className="text-2xl font-bold text-[#39ff14]">سفارش تکمیل شد</h2>
          <div></div>
        </div>

        <div className="text-center py-12">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h3 className="text-3xl font-bold text-green-400 mb-4">سفارش تکمیل شد!</h3>
          <p className="text-gray-300 mb-6 text-lg">
            سفارش شما با موفقیت ثبت شد و به زودی پردازش خواهد شد.
          </p>
          <div className="bg-black/40 rounded-xl p-6 max-w-md mx-auto mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Package className="w-6 h-6 text-[#39ff14]" />
              <span className="text-[#39ff14] font-semibold">شماره سفارش</span>
            </div>
            <p className="text-2xl font-mono text-white">#PSG{Date.now().toString().slice(-6)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            <div className="bg-black/30 rounded-lg p-4">
              <Mail className="w-5 h-5 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">ایمیل تأیید ارسال شد</p>
            </div>
            <div className="bg-black/30 rounded-lg p-4">
              <Shield className="w-5 h-5 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">پرداخت امن انجام شد</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'processing') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div></div>
          <h2 className="text-2xl font-bold text-[#39ff14]">پردازش سفارش</h2>
          <div></div>
        </div>

        <div className="text-center py-16">
          <div className="mb-8">
            <LoadingSpinner size="lg" text="در حال پردازش سفارش..." />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">پردازش سفارش</h3>
          <p className="text-gray-400 mb-8">لطفاً صبر کنید، سفارش شما در حال پردازش است</p>
          
          {/* Progress Steps */}
          <div className="max-w-md mx-auto mb-8">
            <div className="space-y-4">
              {[
                { text: 'تأیید اطلاعات', completed: true },
                { text: 'پردازش پرداخت', completed: true },
                { text: 'ثبت سفارش', completed: false, current: true },
                { text: 'ارسال تأیید', completed: false }
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.completed 
                      ? 'bg-green-500 text-white' 
                      : step.current 
                      ? 'bg-[#39ff14] text-black animate-pulse' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {step.completed ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm ${
                    step.completed 
                      ? 'text-green-400' 
                      : step.current 
                      ? 'text-[#39ff14]' 
                      : 'text-gray-400'
                  }`}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-blue-400 text-sm">
              💡 پردازش معمولاً کمتر از ۳۰ ثانیه طول می‌کشد
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-[#39ff14] transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          بازگشت به سبد خرید
        </button>
        <h2 className="text-2xl font-bold text-[#39ff14]">تکمیل خرید</h2>
        <div></div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300
                    ${isActive 
                      ? 'border-[#39ff14] bg-[#39ff14]/20 text-[#39ff14]' 
                      : 'border-gray-600 text-gray-600'
                    }
                    ${isCurrent ? 'animate-pulse scale-110' : ''}
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-2 ${isActive ? 'text-[#39ff14]' : 'text-gray-600'}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 transition-all duration-300 ${
                    index < currentStepIndex ? 'bg-[#39ff14]' : 'bg-gray-600'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {currentStep === 'customer-info' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-black/40 rounded-xl p-6 border border-[#39ff14]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#39ff14]/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-[#39ff14]" />
              </div>
              <h3 className="text-xl font-bold text-[#39ff14]">اطلاعات مشتری</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm mb-2">نام کامل *</label>
                <input
                  type="text"
                  value={customerInfo.fullName}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="نام و نام خانوادگی خود را وارد کنید"
                  className="w-full p-3 rounded-lg bg-black border border-[#39ff14]/30 text-white focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm mb-2">ایمیل *</label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="ایمیل خود را وارد کنید"
                  className="w-full p-3 rounded-lg bg-black border border-[#39ff14]/30 text-white focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all"
                />
                <p className="text-gray-400 text-xs mt-1">اطلاعات سفارش به این ایمیل ارسال خواهد شد</p>
              </div>
              
              {hasTelegramProduct && (
                <div>
                  <label className="block text-white text-sm mb-2">شناسه تلگرام *</label>
                  <div className="relative">
                    <MessageSquare className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={customerInfo.telegramId}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, telegramId: e.target.value }))}
                      placeholder="@username یا شناسه عددی"
                      className="w-full p-3 pr-12 rounded-lg bg-black border border-[#39ff14]/30 text-white focus:border-[#39ff14] focus:ring focus:ring-[#39ff14]/20 outline-none transition-all"
                    />
                  </div>
                  <p className="text-gray-400 text-xs mt-1">برای فعال‌سازی تلگرام پریمیوم ضروری است</p>
                </div>
              )}
            </div>
            
            <button
              onClick={handleNextStep}
              className="w-full mt-6 bg-gradient-to-r from-[#004d00] to-[#39ff14] text-black py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all"
            >
              ادامه به انتخاب روش پرداخت
            </button>
          </div>
        </div>
      )}

      {currentStep === 'payment-method' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-black/40 rounded-xl p-6 border border-[#39ff14]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#39ff14]/20 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#39ff14]" />
              </div>
              <h3 className="text-xl font-bold text-[#39ff14]">انتخاب روش پرداخت</h3>
            </div>
            
            <div className="space-y-4">
              {/* Wallet Payment */}
              <button
                onClick={() => handlePaymentMethodSelect('wallet')}
                disabled={!canAffordWithWallet}
                className={`w-full p-5 rounded-lg border transition-all text-right ${
                  selectedPaymentMethod === 'wallet' && canAffordWithWallet
                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                    : canAffordWithWallet
                    ? 'bg-black/30 border-[#39ff14]/30 text-white hover:border-[#39ff14]/50'
                    : 'bg-black/20 border-gray-600 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Wallet className="w-6 h-6" />
                    <div>
                      <div className="font-semibold text-lg">پرداخت از کیف پول</div>
                      <div className="text-sm opacity-75">
                        موجودی: {user?.wallet_balance_rial.toLocaleString()} تومان
                      </div>
                    </div>
                  </div>
                  {canAffordWithWallet && (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                </div>
              </button>

              {/* Bank Payment */}
              <button
                onClick={() => handlePaymentMethodSelect('topup-rial')}
                className={`w-full p-5 rounded-lg border transition-all text-right ${
                  selectedPaymentMethod === 'topup-rial'
                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                    : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-4">
                  <CreditCard className="w-6 h-6" />
                  <div>
                    <div className="font-semibold text-lg">شارژ کیف پول + پرداخت</div>
                    <div className="text-sm opacity-75">درگاه بانکی امن (زرین‌پال)</div>
                  </div>
                </div>
              </button>

              {/* Crypto Payment */}
              <button
                onClick={() => handlePaymentMethodSelect('topup-crypto')}
                className={`w-full p-5 rounded-lg border transition-all text-right ${
                  selectedPaymentMethod === 'topup-crypto'
                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                    : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-4">
                  <Smartphone className="w-6 h-6" />
                  <div>
                    <div className="font-semibold text-lg">پرداخت با ارز دیجیتال</div>
                    <div className="text-sm opacity-75">USDT، BTC، ETH، TON و سایر ارزها</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gradient-to-br from-[#39ff14]/10 to-[#004d00]/10 rounded-xl p-6 border border-[#39ff14]/30">
            <h3 className="text-lg font-bold text-[#39ff14] mb-4">خلاصه سفارش</h3>
            <div className="space-y-3 mb-4">
              {cartItems.map((item) => (
                <div key={`${item.id}-${item.option}`} className="flex justify-between items-center">
                  <span className="text-gray-300">{item.title} ({item.option}) × {item.quantity}</span>
                  <span className="text-white font-semibold">{(item.price * item.quantity).toLocaleString()} تومان</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#39ff14]/20 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-white">مجموع کل:</span>
                <span className="text-2xl font-bold text-[#39ff14]">{total.toLocaleString()} تومان</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'wallet-topup' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-bold text-yellow-400">نیاز به شارژ کیف پول</h3>
            </div>
            <p className="text-gray-300">
              برای تکمیل خرید نیاز به شارژ <span className="text-yellow-400 font-semibold">{shortfall.toLocaleString()} تومان</span> دارید.
            </p>
          </div>

          {selectedPaymentMethod === 'topup-crypto' ? (
            <div className="space-y-6">
              <div className="bg-black/40 rounded-xl p-6 border border-[#39ff14]/20">
                <h3 className="text-lg font-bold text-[#39ff14] mb-4">انتخاب درگاه ارز دیجیتال</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setCryptoGateway('payment4')}
                    className={`p-4 rounded-lg border transition-all text-right ${
                      cryptoGateway === 'payment4'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                        : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔗</span>
                      <div>
                        <div className="font-semibold">Payment4</div>
                        <div className="text-xs opacity-75">درگاه ارز دیجیتال حرفه‌ای</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setCryptoGateway('metamask')}
                    className={`p-4 rounded-lg border transition-all text-right ${
                      cryptoGateway === 'metamask'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                        : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🦊</span>
                      <div>
                        <div className="font-semibold">MetaMask</div>
                        <div className="text-xs opacity-75">پرداخت مستقیم با کیف پول</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCryptoGateway('tonkeeper')}
                    className={`p-4 rounded-lg border transition-all text-right ${
                      cryptoGateway === 'tonkeeper'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                        : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💎</span>
                      <div>
                        <div className="font-semibold">Tonkeeper</div>
                        <div className="text-xs opacity-75">پرداخت با TON</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {cryptoGateway === 'payment4' ? (
                <Payment4Gateway
                  tomanAmount={shortfall}
                  onSuccess={handleTopUpSuccess}
                  onCancel={() => setCurrentStep('payment-method')}
                />
              ) : cryptoGateway === 'metamask' ? (
                <USDTPayment
                  tomanAmount={shortfall}
                  onSuccess={handleTopUpSuccess}
                  onCancel={() => setCurrentStep('payment-method')}
                />
              ) : (
                <TonPayment
                  tomanAmount={shortfall}
                  onSuccess={handleTopUpSuccess}
                  onCancel={() => setCurrentStep('payment-method')}
                />
              )}
            </div>
          ) : (
            <ZarinPalPayment
              tomanAmount={shortfall}
              onSuccess={handleTopUpSuccess}
              onCancel={() => setCurrentStep('payment-method')}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CheckoutFlow;