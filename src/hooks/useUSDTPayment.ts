import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { USDT_CONTRACT_ADDRESS, USDT_ABI, STORE_WALLET_ADDRESS, parseUSDT } from '../lib/web3';
import { useNotificationContext } from '../context/NotificationContext';

export const useUSDTPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { showSuccess, showError, showInfo } = useNotificationContext();
  
  const { writeContract, data: hash, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const sendUSDT = async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      showError(
        'مبلغ نامعتبر',
        'لطفاً مبلغ معتبری وارد کنید',
        { duration: 4000 }
      );
      return false;
    }

    setIsProcessing(true);
    
    try {
      showInfo(
        'در حال پردازش...',
        'لطفاً تراکنش را در MetaMask تأیید کنید',
        { duration: 5000 }
      );

      const usdtAmount = parseUSDT(amount);
      
      writeContract({
        address: USDT_CONTRACT_ADDRESS,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [STORE_WALLET_ADDRESS, usdtAmount],
      });

      return true;
    } catch (error: any) {
      console.error('USDT transfer error:', error);
      showError(
        'خطا در پرداخت',
        error.message || 'مشکلی در انجام تراکنش رخ داد',
        { duration: 5000 }
      );
      setIsProcessing(false);
      return false;
    }
  };

  // Handle transaction confirmation
  React.useEffect(() => {
    if (isConfirmed) {
      showSuccess(
        'پرداخت موفق!',
        'تراکنش با موفقیت انجام شد',
        { 
          duration: 6000,
          action: {
            label: 'مشاهده در Etherscan',
            onClick: () => {
              window.open(`https://etherscan.io/tx/${hash}`, '_blank');
            }
          }
        }
      );
      setIsProcessing(false);
    }
  }, [isConfirmed, hash, showSuccess]);

  React.useEffect(() => {
    if (error) {
      showError(
        'خطا در تراکنش',
        'تراکنش لغو شد یا با خطا مواجه شد',
        { duration: 5000 }
      );
      setIsProcessing(false);
    }
  }, [error, showError]);

  return {
    sendUSDT,
    isProcessing: isProcessing || isConfirming,
    isConfirmed,
    transactionHash: hash,
  };
};
