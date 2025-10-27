import React, { useState, useEffect } from 'react';
import { Wallet, ExternalLink, RefreshCw, LogOut, Copy, Check, AlertTriangle } from 'lucide-react';
import { useWeb3Auth } from '../hooks/useWeb3Auth';
import { useNotificationContext } from '../context/NotificationContext';
import { connectTonkeeper, getTonkeeperBalance, detectTonkeeper, waitForTonkeeper } from '../lib/web3';

interface Web3WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const Web3WalletConnect: React.FC<Web3WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const { 
    address, 
    isConnected, 
    chain, 
    ethBalance, 
    usdtBalance, 
    isLoadingBalance, 
    isPending, 
    connectWallet, 
    disconnectWallet, 
    refreshBalance 
  } = useWeb3Auth();
  
  const { showSuccess, showError, showInfo } = useNotificationContext();
  const [copied, setCopied] = useState(false);
  const [tonkeeperConnected, setTonkeeperConnected] = useState(false);
  const [tonkeeperAddress, setTonkeeperAddress] = useState<string>('');
  const [tonBalance, setTonBalance] = useState<string>('0');
  const [isLoadingTon, setIsLoadingTon] = useState(false);
  const [activeWallet, setActiveWallet] = useState<'metamask' | 'tonkeeper' | null>(null);
  const [tonkeeperAvailable, setTonkeeperAvailable] = useState(false);
  const [isCheckingTonkeeper, setIsCheckingTonkeeper] = useState(true);

  // Check Tonkeeper availability on mount
  useEffect(() => {
    const checkTonkeeper = async () => {
      setIsCheckingTonkeeper(true);
      
      // Wait for Tonkeeper to be ready
      const isReady = await waitForTonkeeper(3000);
      setTonkeeperAvailable(isReady || detectTonkeeper());
      
      setIsCheckingTonkeeper(false);
    };

    checkTonkeeper();
  }, []);

  React.useEffect(() => {
    if (isConnected && address && onConnect) {
      onConnect(address);
    } else if (!isConnected && !tonkeeperConnected && onDisconnect) {
      onDisconnect();
    }
  }, [isConnected, address, tonkeeperConnected, onConnect, onDisconnect]);

  const copyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    showSuccess(
      'کپی شد!',
      'آدرس کیف پول کپی شد',
      { duration: 2000 }
    );
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const connectToTonkeeper = async () => {
    setIsLoadingTon(true);
    try {
      showInfo(
        'در حال اتصال...',
        'لطفاً اتصال را در Tonkeeper تأیید کنید',
        { duration: 5000 }
      );

      const result = await connectTonkeeper();
      if (result && result.length > 0) {
        const address = result[0];
        setTonkeeperAddress(address);
        setTonkeeperConnected(true);
        setActiveWallet('tonkeeper');
        
        // Get balance
        try {
          const balance = await getTonkeeperBalance(address);
          setTonBalance(balance);
        } catch (error) {
          console.error('Error getting balance:', error);
          setTonBalance('0');
        }
        
        showSuccess(
          'اتصال موفق!',
          'Tonkeeper با موفقیت متصل شد',
          { duration: 4000 }
        );

        if (onConnect) {
          onConnect(address);
        }
      }
    } catch (error: any) {
      console.error('Tonkeeper connection error:', error);
      
      let errorMessage = 'مشکلی در اتصال به Tonkeeper رخ داد';
      
      if (error.message.includes('not found') || error.message.includes('install')) {
        errorMessage = 'Tonkeeper یافت نشد. لطفاً Tonkeeper را نصب کنید';
      } else if (error.message.includes('rejected') || error.message.includes('denied')) {
        errorMessage = 'اتصال توسط کاربر لغو شد';
      }
      
      showError(
        'خطا در اتصال',
        errorMessage,
        { 
          duration: 6000,
          action: {
            label: 'راهنمای نصب',
            onClick: () => {
              window.open('https://tonkeeper.com', '_blank');
            }
          }
        }
      );
    } finally {
      setIsLoadingTon(false);
    }
  };

  const disconnectTonkeeper = () => {
    setTonkeeperConnected(false);
    setTonkeeperAddress('');
    setTonBalance('0');
    setActiveWallet(null);
    
    showInfo(
      'قطع اتصال',
      'اتصال Tonkeeper قطع شد',
      { duration: 3000 }
    );

    if (onDisconnect) {
      onDisconnect();
    }
  };

  const handleMetaMaskConnect = async () => {
    setActiveWallet('metamask');
    await connectWallet();
  };

  const handleMetaMaskDisconnect = () => {
    setActiveWallet(null);
    disconnectWallet();
  };

  const refreshTonBalance = async () => {
    if (tonkeeperAddress) {
      setIsLoadingTon(true);
      try {
        const balance = await getTonkeeperBalance(tonkeeperAddress);
        setTonBalance(balance);
      } catch (error) {
        console.error('Error refreshing TON balance:', error);
      } finally {
        setIsLoadingTon(false);
      }
    }
  };

  const installTonkeeper = () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const storeUrl = isIOS 
        ? 'https://apps.apple.com/app/tonkeeper/id1587742107'
        : 'https://play.google.com/store/apps/details?id=com.ton_keeper';
      window.open(storeUrl, '_blank');
    } else {
      window.open('https://chrome.google.com/webstore/detail/tonkeeper/jnkelfanjkeadonecabehalmbgpfodjm', '_blank');
    }
  };

  if (!isConnected && !tonkeeperConnected) {
    return (
      <div className="bg-gradient-to-br from-[#39ff14]/10 to-[#004d00]/10 border border-[#39ff14]/30 rounded-xl p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#39ff14]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-[#39ff14]" />
          </div>
          <h3 className="text-xl font-bold text-[#39ff14] mb-2">اتصال کیف پول Web3</h3>
          <p className="text-gray-300 mb-6 text-sm">
            برای پرداخت با ارز دیجیتال، یکی از کیف پول‌های زیر را متصل کنید
          </p>
          
          <div className="space-y-3">
            {/* MetaMask */}
            <button
              onClick={handleMetaMaskConnect}
              disabled={isPending}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-3 px-6 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(251,146,60,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              <span className="text-2xl">🦊</span>
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  در حال اتصال...
                </>
              ) : (
                <>
                  اتصال MetaMask
                  <span className="text-xs opacity-75">(ETH, USDT)</span>
                </>
              )}
            </button>

            {/* Tonkeeper */}
            {isCheckingTonkeeper ? (
              <div className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 px-6 rounded-lg font-bold flex items-center gap-3 opacity-50">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                بررسی Tonkeeper...
              </div>
            ) : tonkeeperAvailable ? (
              <button
                onClick={connectToTonkeeper}
                disabled={isLoadingTon}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 px-6 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <span className="text-2xl">💎</span>
                {isLoadingTon ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    در حال اتصال...
                  </>
                ) : (
                  <>
                    اتصال Tonkeeper
                    <span className="text-xs opacity-75">(TON)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="w-full bg-gray-600 border border-gray-500 text-gray-300 py-3 px-6 rounded-lg font-bold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <div className="flex-1 text-right">
                  <div className="text-sm">Tonkeeper یافت نشد</div>
                  <button
                    onClick={installTonkeeper}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    نصب Tonkeeper
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs">
              💡 نیاز به نصب کیف پول دارید؟ 
              <button 
                onClick={() => window.open('https://metamask.io', '_blank')}
                className="underline hover:text-blue-300 mr-1"
              >
                MetaMask
              </button>
              {' یا '}
              <button 
                onClick={installTonkeeper}
                className="underline hover:text-blue-300"
              >
                Tonkeeper
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#39ff14]/10 to-[#004d00]/10 border border-[#39ff14]/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#39ff14]">
          {activeWallet === 'metamask' ? 'MetaMask متصل' : 'Tonkeeper متصل'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={activeWallet === 'metamask' ? refreshBalance : refreshTonBalance}
            disabled={isLoadingBalance || isLoadingTon}
            className="p-2 bg-black/30 border border-[#39ff14]/30 rounded-lg hover:bg-[#39ff14]/10 transition-all"
            title="به‌روزرسانی موجودی"
          >
            <RefreshCw className={`w-4 h-4 text-[#39ff14] ${(isLoadingBalance || isLoadingTon) ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={activeWallet === 'metamask' ? handleMetaMaskDisconnect : disconnectTonkeeper}
            className="p-2 bg-red-600/20 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-all"
            title="قطع اتصال"
          >
            <LogOut className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="space-y-4">
        {/* Address */}
        <div className="bg-black/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">آدرس کیف پول</p>
              <p className="text-white font-mono text-sm">
                {formatAddress(activeWallet === 'metamask' ? address! : tonkeeperAddress)}
              </p>
            </div>
            <button
              onClick={() => copyAddress(activeWallet === 'metamask' ? address! : tonkeeperAddress)}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Network */}
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">شبکه</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <p className="text-white text-sm">
              {activeWallet === 'metamask' ? (chain?.name || 'Ethereum') : 'TON Network'}
            </p>
          </div>
        </div>

        {/* Balances */}
        {activeWallet === 'metamask' ? (
          <div className="grid grid-cols-2 gap-3">
            {/* ETH Balance */}
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">ETH</p>
              <p className="text-white font-semibold">
                {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '0.0000'}
              </p>
            </div>

            {/* USDT Balance */}
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">USDT</p>
              <p className="text-[#39ff14] font-semibold">
                {isLoadingBalance ? '...' : usdtBalance}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">TON</p>
            <p className="text-[#39ff14] font-semibold">
              {isLoadingTon ? '...' : parseFloat(tonBalance).toFixed(4)}
            </p>
          </div>
        )}

        {/* Explorer Link */}
        <a
          href={
            activeWallet === 'metamask' 
              ? `https://etherscan.io/address/${address}`
              : `https://tonscan.org/address/${tonkeeperAddress}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-black/30 border border-gray-600 rounded-lg py-2 px-3 hover:border-[#39ff14]/50 transition-all text-sm text-gray-300 hover:text-[#39ff14]"
        >
          <ExternalLink className="w-4 h-4" />
          مشاهده در {activeWallet === 'metamask' ? 'Etherscan' : 'Tonscan'}
        </a>
      </div>
    </div>
  );
};

export default Web3WalletConnect;