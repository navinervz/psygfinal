import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  DollarSign,
  Send,
  CheckCircle,
  QrCode,
  Copy,
  Check,
  Wallet,
  Bitcoin,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';

interface Payment4GatewayProps {
  tomanAmount: number;
  onSuccess?: (paymentId: string, transactionHash: string | undefined) => void;
  onCancel?: () => void;
}

interface SupportedCurrency {
  code: string;
  name: string;
  network: string;
}

interface ExchangeRates {
  [currency: string]: number;
}

interface PaymentData {
  paymentId: string;
  paymentUrl: string;
  walletAddress: string;
  currency: string;
  amount: number;
  exchangeRate: number;
  tomanEquivalent: number;
  qrCode?: string;
}

const POLLING_INTERVAL = 10_000; // ms

const Payment4Gateway: React.FC<Payment4GatewayProps> = ({ tomanAmount, onSuccess, onCancel }) => {
  const { showSuccess, showError, showInfo } = useNotificationContext();

  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  useEffect(() => {
    refreshExchangeRates();
    fetchSupportedCurrencies();
  }, [refreshExchangeRates, fetchSupportedCurrencies]);

  useEffect(() => {
    if (!paymentData || paymentStatus !== 'pending') {
      return;
    }

    const interval = setInterval(() => {
      checkPaymentStatus(paymentData.paymentId);
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [paymentData, paymentStatus, checkPaymentStatus]);

  const refreshExchangeRates = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      const { data } = await axios.get('/api/prices/current');
      if (data?.success && data?.prices) {
        setExchangeRates(data.prices as ExchangeRates);
      } else {
        throw new Error('Exchange rates are not available.');
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      showError('Unable to load rates', 'We could not retrieve the latest exchange rates. Please try again.');
    } finally {
      setIsLoadingRates(false);
    }
  }, [showError]);

  const fetchSupportedCurrencies = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/payments/crypto/currencies');
      if (data?.success && Array.isArray(data.currencies)) {
        setSupportedCurrencies(data.currencies);
        if (!data.currencies.find((item: SupportedCurrency) => item.code === selectedCurrency)) {
          setSelectedCurrency(data.currencies[0]?.code ?? 'USDT');
        }
      }
    } catch (error) {
      console.error('Error fetching supported currencies:', error);
      setSupportedCurrencies([
        { code: 'USDT', name: 'Tether', network: 'Ethereum' },
        { code: 'BTC', name: 'Bitcoin', network: 'Bitcoin' },
        { code: 'ETH', name: 'Ethereum', network: 'Ethereum' },
        { code: 'TON', name: 'Toncoin', network: 'TON' },
      ]);
    }
  }, [selectedCurrency]);

  const activeRate = useMemo(() => {
    if (!exchangeRates) return null;
    const normalizedKey = selectedCurrency.toUpperCase();
    if (normalizedKey === 'USDT') {
      return exchangeRates.USDT ?? exchangeRates['USDT-IRT'];
    }
    return exchangeRates[normalizedKey] ?? null;
  }, [exchangeRates, selectedCurrency]);

  const calculateCryptoAmount = () => {
    if (useCustomAmount) {
      return Number(customAmount) || 0;
    }
    if (!activeRate || activeRate <= 0) return 0;
    return tomanAmount / activeRate;
  };

  const calculateTomanEquivalent = () => {
    if (useCustomAmount) {
      const num = Number(customAmount) || 0;
      return activeRate ? num * activeRate : 0;
    }
    return tomanAmount;
  };

  const createPayment = async () => {
    const cryptoAmount = calculateCryptoAmount();
    if (!cryptoAmount || cryptoAmount <= 0) {
      showError('Invalid amount', 'Please choose a valid payment amount.');
      return;
    }

    setIsProcessing(true);
    try {
      showInfo('Creating payment request…');
      const { data } = await axios.post('/api/payments/crypto/request', {
        amount: cryptoAmount,
        currency: selectedCurrency,
        description: `Wallet top-up - ${calculateTomanEquivalent().toLocaleString('fa-IR')} IRR`,
      });

      if (data?.success) {
        const payload: PaymentData = {
          paymentId: data.paymentId,
          paymentUrl: data.paymentUrl,
          walletAddress: data.walletAddress,
          currency: data.currency,
          amount: data.amount,
          exchangeRate: data.exchangeRate,
          tomanEquivalent: data.tomanEquivalent,
          qrCode: data.qrCode,
        };
        setPaymentData(payload);
        setPaymentStatus('pending');
        showSuccess('Payment request created', 'Complete the transfer in your crypto wallet.');
      } else {
        throw new Error(data?.message || 'Unable to create payment request.');
      }
    } catch (error: any) {
      console.error('Payment creation error:', error);
      showError('Failed to create payment', error?.message || 'Something went wrong while creating the payment request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      const { data } = await axios.get(`/api/payments/crypto/verify/${paymentId}`);
      if (!data?.success) return;

      if (data.status === 'completed') {
        setPaymentStatus('completed');
        showSuccess('Payment confirmed', `${Number(data.tomanEquivalent ?? 0).toLocaleString('fa-IR')} IRR has been added to your wallet.`);
        if (onSuccess) {
          onSuccess(paymentId, data.transactionHash);
        }
      } else if (['failed', 'expired', 'cancelled'].includes(data.status)) {
        setPaymentStatus('failed');
        showError('Payment not completed', data.message || 'The payment provider returned a failure status.');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }, [onSuccess, showError, showSuccess]);

  const copyToClipboard = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
      showSuccess('Copied to clipboard', 'Information was copied successfully.');
    } catch (error) {
      showError('Copy failed', 'We could not copy the value to your clipboard.');
    }
  };

  const renderCurrencyIcon = (currency: string) => {
    switch (currency) {
      case 'BTC':
        return <Bitcoin className="w-5 h-5" />;
      case 'ETH':
        return <Zap className="w-5 h-5" />;
      default:
        return <DollarSign className="w-5 h-5" />;
    }
  };

  if (paymentStatus === 'completed') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-green-400 mb-2">Payment completed</h3>
        <p className="text-gray-300 text-sm">Your wallet balance was updated successfully.</p>
      </div>
    );
  }

  if (paymentData && paymentStatus === 'pending') {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            {renderCurrencyIcon(paymentData.currency)}
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-400">{paymentData.currency} payment pending</h3>
            <p className="text-gray-400 text-sm">Waiting for blockchain confirmation</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Crypto amount:</span>
              <span className="text-white font-semibold">
                {paymentData.amount.toFixed(paymentData.currency === 'BTC' ? 8 : 6)} {paymentData.currency}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Equivalent (IRR):</span>
              <span className="text-[#39ff14] font-semibold">
                {Math.round(paymentData.tomanEquivalent).toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Destination wallet:</span>
              <button
                onClick={() => copyToClipboard(paymentData.walletAddress, 'wallet')}
                className="text-[#39ff14] hover:text-white transition-colors"
              >
                {copied.wallet ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-white font-mono text-sm break-all">{paymentData.walletAddress}</p>
          </div>

          {paymentData.qrCode && (
            <div className="bg-black/30 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <QrCode className="w-5 h-5 text-[#39ff14]" />
                <span className="text-white text-sm">Scan QR Code</span>
              </div>
              <img
                src={paymentData.qrCode}
                alt="QR Code"
                className="mx-auto w-32 h-32 border border-[#39ff14]/30 rounded-lg"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <a
            href={paymentData.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Open payment link
          </a>

          {onCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
            <span className="text-yellow-400 text-sm font-semibold">Awaiting confirmations…</span>
          </div>
          <p className="text-gray-300 text-xs mt-1">
            As soon as the transaction is confirmed on-chain, your wallet balance will be updated automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-purple-400">Pay with cryptocurrency</h3>
          <p className="text-gray-400 text-sm">Payment4 gateway</p>
        </div>
        <button
          onClick={refreshExchangeRates}
          disabled={isLoadingRates}
          className="p-2 bg-black/30 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-all"
          title="Refresh rates"
        >
          <RefreshCw className={`w-4 h-4 text-purple-400 ${isLoadingRates ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {exchangeRates && (
        <div className="mb-6 p-4 bg-black/30 rounded-lg">
          <h4 className="text-white text-sm font-semibold mb-3">Current market rates</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(exchangeRates)
              .filter(([currency]) => ['USDT', 'BTC', 'ETH', 'TON'].includes(currency.toUpperCase()))
              .map(([currency, rate]) => (
                <div key={currency} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {renderCurrencyIcon(currency)}
                    <span className="text-white text-xs font-semibold">{currency.toUpperCase()}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{Math.round(rate).toLocaleString('fa-IR')} تومان</p>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-white text-sm font-semibold mb-3">Select currency</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {supportedCurrencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => setSelectedCurrency(currency.code)}
              className={`p-3 rounded-lg border transition-all text-center ${
                selectedCurrency === currency.code
                  ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                  : 'bg-black/30 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {renderCurrencyIcon(currency.code)}
              </div>
              <div className="text-xs font-semibold">{currency.code}</div>
              <div className="text-xs opacity-75">{currency.network}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3">
          <input
            type="radio"
            id="auto-amount"
            checked={!useCustomAmount}
            onChange={() => setUseCustomAmount(false)}
            className="text-[#39ff14]"
          />
          <label htmlFor="auto-amount" className="text-white text-sm">
            Use order amount ({tomanAmount.toLocaleString('fa-IR')} تومان)
          </label>
        </div>

        {!useCustomAmount && (
          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Crypto amount:</span>
              <span className="text-purple-400 font-semibold">
                {calculateCryptoAmount().toFixed(selectedCurrency === 'BTC' ? 8 : 4)} {selectedCurrency}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="radio"
            id="custom-amount"
            checked={useCustomAmount}
            onChange={() => setUseCustomAmount(true)}
            className="text-[#39ff14]"
          />
          <label htmlFor="custom-amount" className="text-white text-sm">
            Enter custom amount in {selectedCurrency}
          </label>
        </div>

        {useCustomAmount && (
          <div className="space-y-3">
            <input
              type="number"
              min="0"
              step="0.000001"
              placeholder={`Amount in ${selectedCurrency}`}
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              className="w-full bg-black/30 border border-purple-500/30 rounded-lg py-2 px-3 text-white focus:border-purple-500 focus:ring focus:ring-purple-500/20 outline-none transition-all"
            />
            <div className="bg-black/30 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Equivalent (IRR):</span>
                <span className="text-white font-semibold">
                  {Math.round(calculateTomanEquivalent()).toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={createPayment}
          disabled={isProcessing || !activeRate || (useCustomAmount && !customAmount)}
          className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating payment…
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Create payment request
            </>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-purple-400 text-xs">
          All operations are executed through the secured Node.js backend. The wallet balance will update automatically once the transaction is confirmed.
        </p>
      </div>
    </div>
  );
};

export default Payment4Gateway;
