import React, { useEffect, useMemo, useState } from 'react';
import { Send, AlertTriangle, CheckCircle, RefreshCw, Download } from 'lucide-react';
import {
  connectTonkeeper,
  sendTonTransaction,
  STORE_TON_WALLET_ADDRESS,
  tomanToTon,
  tonToToman,
  getTonkeeperBalance,
  detectTonkeeper,
  waitForTonkeeper,
} from '../lib/web3';
import { useNotificationContext } from '../context/NotificationContext';

interface TonPaymentProps {
  tomanAmount: number;
  onSuccess?: (transactionHash: string) => void;
  onCancel?: () => void;
}

const NANOTON_PER_TON = 1_000_000_000;

const TonPayment: React.FC<TonPaymentProps> = ({ tomanAmount, onSuccess, onCancel }) => {
  const { showSuccess, showError, showInfo } = useNotificationContext();
  const [tonAddress, setTonAddress] = useState('');
  const [tonBalance, setTonBalance] = useState('0');
  const [isCheckingClient, setIsCheckingClient] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const tonAmount = useMemo(() => (
    useCustomAmount && customAmount
      ? Number(customAmount) || 0
      : Number(tomanToTon(tomanAmount).toFixed(4))
  ), [useCustomAmount, customAmount, tomanAmount]);

  const tomanEquivalent = useMemo(() => (
    useCustomAmount && customAmount
      ? tonToToman(Number(customAmount) || 0)
      : tomanAmount
  ), [useCustomAmount, customAmount, tomanAmount]);

  useEffect(() => {
    const checkClient = async () => {
      setIsCheckingClient(true);
      const ready = await waitForTonkeeper(2500);
      if (!ready && !detectTonkeeper()) {
        showInfo('برای پرداخت با TON ابتدا Tonkeeper را نصب کنید.', 'پس از نصب به این صفحه برگردید.', { duration: 6000 });
      }
      setIsCheckingClient(false);
    };

    checkClient();
  }, [showInfo]);

  useEffect(() => {
    if (!tonAddress) return;

    const loadBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const balance = await getTonkeeperBalance(tonAddress);
        setTonBalance(balance);
      } catch (error) {
        console.error('Failed to fetch TON balance', error);
        showError('دریافت موجودی ناموفق بود', 'بعداً دوباره تلاش کنید.');
        setTonBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    loadBalance();
  }, [tonAddress, showError]);

  const handleConnect = async () => {
    setIsProcessing(true);
    try {
      showInfo('در حال اتصال به Tonkeeper…', 'لطفاً درخواست اتصال را در موبایل یا افزونه تایید کنید.', { duration: 6000 });
      const accounts = await connectTonkeeper();
      if (!accounts || accounts.length === 0) {
        throw new Error('آدرسی از Tonkeeper دریافت نشد.');
      }
      const address = accounts[0];
      setTonAddress(address);
      setIsConnected(true);
      showSuccess('کیف پول متصل شد', 'اکنون می‌توانید پرداخت خود را انجام دهید.');
    } catch (error: any) {
      console.error('Tonkeeper connection error', error);
      showError('اتصال ناموفق بود', error?.message || 'امکان اتصال به Tonkeeper وجود ندارد.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!tonAddress) return;
    setIsLoadingBalance(true);
    try {
      const balance = await getTonkeeperBalance(tonAddress);
      setTonBalance(balance);
    } catch (error) {
      console.error('Failed to refresh TON balance', error);
      showError('به‌روزرسانی موجودی ناموفق بود', 'لطفاً دوباره امتحان کنید.');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handlePayment = async () => {
    if (!isConnected || !tonAddress) {
      showError('ابتدا کیف پول را متصل کنید', 'برای ادامه پرداخت لازم است Tonkeeper متصل باشد.');
      return;
    }

    if (tonAmount <= 0) {
      showError('مبلغ نامعتبر', 'لطفاً مقدار TON معتبر وارد کنید.');
      return;
    }

    if (parseFloat(tonBalance) < tonAmount) {
      showError('موجودی کافی نیست', 'موجودی TON شما برای این تراکنش کافی نیست.');
      return;
    }

    setIsProcessing(true);
    try {
      showInfo('در حال ارسال تراکنش…', 'لطفاً درخواست Tonkeeper را تایید کنید.', { duration: 8000 });
      const nanotons = BigInt(Math.round(tonAmount * NANOTON_PER_TON)).toString();
      const result = await sendTonTransaction(STORE_TON_WALLET_ADDRESS, nanotons);
      setIsConfirmed(true);
      setTransactionHash(result?.hash ?? '');
      showSuccess('تراکنش ثبت شد', 'پس از تایید شبکه، کیف پول شما شارژ می‌شود.');
      if (onSuccess) onSuccess(result?.hash ?? '');
    } catch (error: any) {
      console.error('TON payment error', error);
      showError('پرداخت انجام نشد', error?.message || 'Tonkeeper تراکنش را ارسال نکرد.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isCheckingClient) {
    return (
      <div className="bg-black/40 border border-slate-700 rounded-xl p-6 text-center">
        <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-slate-300" />
        <p className="text-slate-100 text-sm">در حال بررسی دسترسی به Tonkeeper…</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-black/40 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-6 h-6 text-[#39ff14]" />
          <h3 className="text-lg font-bold text-white">اتصال Tonkeeper</h3>
        </div>
        <p className="text-slate-300 text-sm mb-4">
          برای پرداخت با TON، برنامه Tonkeeper را در موبایل یا افزونه مرورگر نصب کنید و روی دکمه زیر بزنید.
        </p>
        <button
          onClick={handleConnect}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50"
        >
          {isProcessing ? 'در حال اتصال…' : 'اتصال به Tonkeeper'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-slate-700 rounded-xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">پرداخت با TON</h3>
          <p className="text-slate-300 text-sm">آدرس متصل: <span className="font-mono text-[#39ff14]">{tonAddress}</span></p>
        </div>
        <button
          onClick={handleRefreshBalance}
          className="flex items-center gap-2 text-slate-200 text-sm border border-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-700/40 transition"
          disabled={isLoadingBalance}
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
          موجودی Ton
        </button>
      </div>

      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
        <div className="flex justify-between text-sm text-slate-300">
          <span>موجودی فعلی:</span>
          <span className="text-[#39ff14] font-bold">{isLoadingBalance ? '…' : `${parseFloat(tonBalance).toFixed(4)} TON`}</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="radio"
            checked={!useCustomAmount}
            onChange={() => setUseCustomAmount(false)}
            className="text-[#39ff14]"
          />
          استفاده از مبلغ سفارش ({tomanAmount.toLocaleString('fa-IR')} تومان)
        </label>
        {!useCustomAmount && (
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 text-sm text-slate-200">
            <div className="flex justify-between">
              <span>معادل TON:</span>
              <span className="text-blue-300 font-semibold">{tonAmount.toFixed(4)} TON</span>
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="radio"
            checked={useCustomAmount}
            onChange={() => setUseCustomAmount(true)}
            className="text-[#39ff14]"
          />
          وارد کردن مبلغ دلخواه به TON
        </label>
        {useCustomAmount && (
          <div className="space-y-3">
            <input
              type="number"
              step="0.0001"
              min="0"
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              placeholder="مثلاً 1.25"
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2 px-3 text-white focus:border-[#39ff14] focus:outline-none"
            />
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-sm text-slate-200">
              <div className="flex justify-between">
                <span>معادل ریالی:</span>
                <span className="font-semibold">{Math.round(tomanEquivalent).toLocaleString('fa-IR')} تومان</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {parseFloat(tonBalance) < tonAmount && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-1" />
          <div>
            <h4 className="text-red-300 text-sm font-semibold">موجودی ناکافی</h4>
            <p className="text-slate-200 text-xs mt-1">برای این پرداخت به حداقل {tonAmount.toFixed(4)} TON نیاز دارید. لطفاً ابتدا کیف پول خود را شارژ کنید.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handlePayment}
          disabled={isProcessing || parseFloat(tonBalance) < tonAmount}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              در حال ارسال تراکنش…
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              پرداخت {tonAmount.toFixed(4)} TON
            </>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="bg-slate-700 text-white py-3 px-4 rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
          >
            انصراف
          </button>
        )}
      </div>

      {isConfirmed && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-green-200 text-sm">تراکنش ثبت شد. در صورت نیاز می‌توانید هش را در بلاک‌اکسپلورر دنبال کنید:</p>
          {transactionHash && (
            <a
              href={`https://tonviewer.com/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-300 underline"
            >
              مشاهده تراکنش در Tonviewer
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default TonPayment;
