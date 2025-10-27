import React, { useState } from 'react';
import { DollarSign, Send, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useUSDTPayment } from '../hooks/useUSDTPayment';
import { useWeb3Auth } from '../hooks/useWeb3Auth';
import { tomanToUsdt, usdtToToman } from '../lib/web3';

interface USDTPaymentProps {
  tomanAmount: number;
  onSuccess?: (transactionHash: string) => void;
  onCancel?: () => void;
}

const USDTPayment: React.FC<USDTPaymentProps> = ({ tomanAmount, onSuccess, onCancel }) => {
  const { isConnected, usdtBalance } = useWeb3Auth();
  const { sendUSDT, isProcessing, isConfirmed, transactionHash } = useUSDTPayment();
  const [customAmount, setCustomAmount] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);

  const usdtAmount = useCustomAmount && customAmount 
    ? parseFloat(customAmount) 
    : tomanToUsdt(tomanAmount);
  
  const equivalentToman = useCustomAmount && customAmount 
    ? usdtToToman(parseFloat(customAmount))
    : tomanAmount;

  const hasEnoughBalance = parseFloat(usdtBalance) >= usdtAmount;

  React.useEffect(() => {
    if (isConfirmed && transactionHash && onSuccess) {
      onSuccess(transactionHash);
    }
  }, [isConfirmed, transactionHash, onSuccess]);

  const handlePayment = async () => {
    const success = await sendUSDT(usdtAmount.toString());
    if (!success) {
      // Error handling is done in the hook
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-yellow-400 mb-2">Ú©ÛŒÙ Ù¾ÙˆÙ„ Ù…ØªØµÙ„ Ù†ÛŒØ³Øª</h3>
        <p className="text-gray-300 text-sm">
          Ø¨Ø±Ø§ÛŒ Ù¾Ø±Ø¯Ø§Ø®Øª Ø¨Ø§ USDTØŒ Ø§Ø¨ØªØ¯Ø§ Ú©ÛŒÙ Ù¾ÙˆÙ„ Ø®ÙˆØ¯ Ø±Ø§ Ù…ØªØµÙ„ Ú©Ù†ÛŒØ¯
        </p>
      </div>
    );
  }

  if (isConfirmed) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-green-400 mb-2">Ù¾Ø±Ø¯Ø§Ø®Øª Ù…ÙˆÙÙ‚!</h3>
        <p className="text-gray-300 text-sm mb-4">
          ØªØ±Ø§Ú©Ù†Ø´ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯
        </p>
        {transactionHash && (
          <a
            href={`https://etherscan.io/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] px-4 py-2 rounded-lg hover:bg-[#39ff14]/30 transition-all text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Ù…Ø´Ø§Ù‡Ø¯Ù‡ ØªØ±Ø§Ú©Ù†Ø´
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-blue-400">Ù¾Ø±Ø¯Ø§Ø®Øª Ø¨Ø§ USDT</h3>
          <p className="text-gray-400 text-sm">Ø´Ø¨Ú©Ù‡ Ø§ØªØ±ÛŒÙˆÙ…</p>
        </div>
      </div>

      {/* Amount Selection */}
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
            Ù…Ø¨Ù„Øº Ø®ÙˆØ¯Ú©Ø§Ø± (Ø¨Ø± Ø§Ø³Ø§Ø³ Ù†Ø±Ø® Ø±ÙˆØ²)
          </label>
        </div>

        {!useCustomAmount && (
          <div className="bg-black/30 rounded-lg p-4 mr-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Ù…Ø¨Ù„Øº ØªÙˆÙ…Ø§Ù†:</span>
              <span className="text-white font-semibold">{tomanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-400 text-sm">Ù…Ø¹Ø§Ø¯Ù„ USDT:</span>
              <span className="text-blue-400 font-semibold">{usdtAmount.toFixed(2)}</span>
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
            Ù…Ø¨Ù„Øº Ø¯Ù„Ø®ÙˆØ§Ù‡ USDT
          </label>
        </div>

        {useCustomAmount && (
          <div className="mr-6 space-y-3">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ù…Ø¨Ù„Øº USDT"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-black/30 border border-blue-500/30 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:ring focus:ring-blue-500/20 outline-none transition-all"
            />
            {customAmount && (
              <div className="bg-black/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Ù…Ø¹Ø§Ø¯Ù„ ØªÙˆÙ…Ø§Ù†:</span>
                  <span className="text-white font-semibold">{equivalentToman.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Balance Check */}
      <div className="bg-black/30 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Ù…ÙˆØ¬ÙˆØ¯ÛŒ USDT:</span>
          <span className="text-[#39ff14] font-semibold">{usdtBalance}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-400 text-sm">Ù…Ø¨Ù„Øº Ù…ÙˆØ±Ø¯ Ù†ÛŒØ§Ø²:</span>
          <span className={`font-semibold ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`}>
            {usdtAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Warning for insufficient balance */}
      {!hasEnoughBalance && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm font-semibold">Ù…ÙˆØ¬ÙˆØ¯ÛŒ Ù†Ø§Ú©Ø§ÙÛŒ</span>
          </div>
          <p className="text-gray-300 text-xs mt-1">
            Ù…ÙˆØ¬ÙˆØ¯ÛŒ USDT Ø´Ù…Ø§ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† ØªØ±Ø§Ú©Ù†Ø´ Ú©Ø§ÙÛŒ Ù†ÛŒØ³Øª
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePayment}
          disabled={isProcessing || !hasEnoughBalance || (useCustomAmount && !customAmount)}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Ø¯Ø± Ø­Ø§Ù„ Ù¾Ø±Ø¯Ø§Ø²Ø´...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Ù¾Ø±Ø¯Ø§Ø®Øª {usdtAmount.toFixed(2)} USDT
            </>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            Ù„ØºÙˆ
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-400 text-xs">
          ðŸ’¡ Ù†Ø±Ø® ØªØ¨Ø¯ÛŒÙ„ ØªÙ‚Ø±ÛŒØ¨ÛŒ: 1 USDT = 65,000 ØªÙˆÙ…Ø§Ù†
        </p>
      </div>
    </div>
  );
};

export default USDTPayment;
