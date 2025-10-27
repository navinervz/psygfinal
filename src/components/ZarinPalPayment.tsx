import React, { useState } from 'react';
import { CreditCard, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';

interface ZarinPalPaymentProps {
  tomanAmount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ZarinPalPayment: React.FC<ZarinPalPaymentProps> = ({ tomanAmount, onSuccess, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { showSuccess, showError, showInfo } = useNotificationContext();

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      showInfo(
        'در حال ایجاد درخواست پرداخت...',
        'لطفاً صبر کنید',
        { duration: 3000 }
      );

      // Simulate ZarinPal payment request
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, this would call ZarinPal API
      const mockPaymentUrl = `https://www.zarinpal.com/pg/StartPay/000000000000000000000000000000000000`;
      setPaymentUrl(mockPaymentUrl);
      
      showSuccess(
        'درخواست پرداخت ایجاد شد!',
        'به درگاه پرداخت هدایت می‌شوید',
        { duration: 4000 }
      );

      // Simulate successful payment after 3 seconds
      setTimeout(() => {
        setIsConfirmed(true);
        showSuccess(
          'پرداخت موفق!',
          'پرداخت شما با موفقیت انجام شد',
          { duration: 6000 }
        );
        
        if (onSuccess) {
          onSuccess();
        }
      }, 3000);
      
    } catch (error: any) {
      console.error('ZarinPal payment error:', error);
      showError(
        'خطا در پرداخت',
        error.message || 'مشکلی در ایجاد درخواست پرداخت رخ داد',
        { duration: 5000 }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-green-400 mb-2">پرداخت موفق!</h3>
        <p className="text-gray-300 text-sm mb-4">
          پرداخت شما با موفقیت از طریق زرین‌پال انجام شد
        </p>
        <div className="bg-black/30 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">مبلغ پرداختی:</span>
            <span className="text-[#39ff14] font-semibold">{tomanAmount.toLocaleString()} تومان</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-green-400">پرداخت با زرین‌پال</h3>
          <p className="text-gray-400 text-sm">درگاه بانکی امن</p>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-black/30 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm">مبلغ قابل پرداخت:</span>
          <span className="text-white font-semibold">{tomanAmount.toLocaleString()} تومان</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">درگاه پرداخت:</span>
          <span className="text-green-400 font-semibold">زرین‌پال</span>
        </div>
      </div>

      {/* Security Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="bg-black/20 rounded-lg p-3 flex items-center gap-2">
          <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-green-400" />
          </div>
          <span className="text-white text-xs">پرداخت امن</span>
        </div>
        <div className="bg-black/20 rounded-lg p-3 flex items-center gap-2">
          <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-green-400" />
          </div>
          <span className="text-white text-xs">تأیید فوری</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              در حال پردازش...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              پرداخت {tomanAmount.toLocaleString()} تومان
            </>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            لغو
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-semibold">نکات مهم:</span>
        </div>
        <ul className="text-green-300 text-xs space-y-1">
          <li>• پس از کلیک روی دکمه پرداخت، به درگاه زرین‌پال هدایت می‌شوید</li>
          <li>• پرداخت از تمامی کارت‌های بانکی پشتیبانی می‌شود</li>
          <li>• پس از پرداخت موفق، به صورت خودکار به سایت بازگردانده می‌شوید</li>
        </ul>
      </div>
    </div>
  );
};

export default ZarinPalPayment;