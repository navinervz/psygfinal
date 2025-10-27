import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { readContract } from '@wagmi/core';
import { wagmiConfig, USDT_CONTRACT_ADDRESS, USDT_ABI, formatUSDT } from '../lib/web3';
import { useNotificationContext } from '../context/NotificationContext';

export const useWeb3Auth = () => {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { showError, showInfo } = useNotificationContext();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get USDT balance
  const fetchUSDTBalance = useCallback(async () => {
    if (!address || !isConnected) return;

    setIsLoadingBalance(true);
    try {
      const balance = await readContract(wagmiConfig, {
        address: USDT_CONTRACT_ADDRESS,
        abi: USDT_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      setUsdtBalance(formatUSDT(balance));
    } catch (error) {
      console.error('Error fetching USDT balance:', error);
      setUsdtBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUSDTBalance();
    } else {
      setUsdtBalance('0');
    }
  }, [isConnected, address, fetchUSDTBalance]);

  const connectWallet = async () => {
    try {
      const metaMaskConnector = connectors.find(connector => connector.name === 'MetaMask');
      if (metaMaskConnector) {
        connect({ connector: metaMaskConnector });
      } else {
        showError(
          'MetaMask یافت نشد',
          'لطفاً MetaMask را نصب کنید',
          { duration: 5000 }
        );
      }
    } catch (error) {
      showError(
        'خطا در اتصال',
        'مشکلی در اتصال به کیف پول رخ داد',
        { duration: 5000 }
      );
    }
  };

  const disconnectWallet = () => {
    disconnect();
    showInfo(
      'قطع اتصال',
      'اتصال کیف پول قطع شد',
      { duration: 3000 }
    );
  };

  const refreshBalance = () => {
    fetchUSDTBalance();
  };

  return {
    address,
    isConnected,
    chain,
    ethBalance,
    usdtBalance,
    isLoadingBalance,
    isPending,
    connectWallet,
    disconnectWallet,
    refreshBalance,
  };
};