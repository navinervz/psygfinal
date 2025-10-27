// src/lib/web3.ts
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { metaMask, walletConnect } from 'wagmi/connectors';

/* =========================
 *  ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ù¾Ø§ÛŒÙ‡ Ùˆ Ø«Ø§Ø¨Øªâ€ŒÙ‡Ø§
 * ========================= */

// Ø¢Ø¯Ø±Ø³ Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯ USDT Ø±ÙˆÛŒ Ø§ØªØ±ÛŒÙˆÙ… (Mainnet)
export const USDT_CONTRACT_ADDRESS =
  '0xdAC17F958D2ee523a2206206994597C13D831ec7';

// ABI Ù…Ø®ØªØµØ± USDT (ÙÙ‚Ø· ØªÙˆØ§Ø¨Ø¹ Ù¾Ø±Ú©Ø§Ø±Ø¨Ø±Ø¯)
export const USDT_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

// Ú©ÛŒÙâ€ŒÙ¾ÙˆÙ„â€ŒÙ‡Ø§ÛŒ ÙØ±ÙˆØ´Ú¯Ø§Ù‡
export const STORE_WALLET_ADDRESS = (import.meta as any)?.env?.VITE_STORE_ETH_WALLET || ''; // ETH/USDT
export const STORE_TON_WALLET_ADDRESS = (import.meta as any)?.env?.VITE_STORE_TON_WALLET || ''; // TON

// ENV Ø¨Ø±Ø§ÛŒ Ú©Ù†ØªØ±Ù„ WalletConnect Ø¯Ø± Ù„ÙˆÚ©Ø§Ù„ (Ø¨Ù‡â€ŒØµÙˆØ±Øª Ù¾ÛŒØ´â€ŒÙØ±Ø¶ Ø®Ø§Ù…ÙˆØ´ ØªØ§ CORS Ù†Ø¯Ù‡)
const ENABLE_WALLETCONNECT =
  (import.meta as any)?.env?.VITE_ENABLE_WALLETCONNECT === 'true';

// RPC Ù‡Ø§ (Ø¯Ø± ØµÙˆØ±Øª Ù†Ø¨ÙˆØ¯ ENV Ø§Ø² llama RPC Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…)
const MAINNET_RPC =
  (import.meta as any)?.env?.VITE_MAINNET_RPC_URL || 'https://eth.llamarpc.com';
const SEPOLIA_RPC =
  (import.meta as any)?.env?.VITE_SEPOLIA_RPC_URL || 'https://sepolia.llamarpc.com';

// Ø´Ù†Ø§Ø³Ù‡ Ù¾Ø±ÙˆÚ˜Ù‡Ù” WalletConnect (Ø¯Ø± ØµÙˆØ±Øª ÙØ¹Ø§Ù„â€ŒØ³Ø§Ø²ÛŒ)
const WC_PROJECT_ID =
  (import.meta as any)?.env?.VITE_WALLETCONNECT_PROJECT_ID ||
  '2f05a7cdc1588bc900adc5b17a2b8e32'; // ØµØ±ÙØ§Ù‹ Ø¨Ø±Ø§ÛŒ dev

// ÙØ§Ù„Ø¨Ú© Ù†Ø±Ø® ØªØªØ± (ØªÙˆÙ…Ø§Ù†) Ø¯Ø± ØµÙˆØ±Øª Ù‚Ø·Ø¹ Ù†ÙˆØ¨ÛŒØªÚ©Ø³/Ø¨Ú©â€ŒØ§Ù†Ø¯
const FALLBACK_TOMAN_PER_USDT = Number(
  (import.meta as any)?.env?.VITE_FALLBACK_USDT_TOMAN || 100_000
);

/* =========================
 *  Ù¾ÛŒÚ©Ø±Ø¨Ù†Ø¯ÛŒ wagmi (Ø¨Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„ Ø®ÙˆØ¯Ú©Ø§Ø±)
 * ========================= */

const connectors = [
  metaMask({
    // ÙÙ‚Ø· Ø§Ú©Ø³ØªÙ†Ø´Ù† Ù…Ø±ÙˆØ±Ú¯Ø±Ø› Ø§Ø² MetaMask SDK (mob/desktop) Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù†Ú©Ù† â†’ Ø®Ø·Ø§Ù‡Ø§ÛŒ CORS Ú©Ù…ØªØ±
    extensionOnly: true,
    // Ø¯ÛŒØ³Ú©Ø§Ù†Ú©Øª Ø´Ø¨ÛŒÙ‡â€ŒØ³Ø§Ø²ÛŒâ€ŒØ´Ø¯Ù‡: Ú©Ù…Ú© Ù…ÛŒâ€ŒÚ©Ù†Ø¯ Â«Ø®Ø±ÙˆØ¬Â» Ø¯Ø±Ø³Øª Ú©Ø§Ø± Ú©Ù†Ø¯
    shimDisconnect: true,
    // Ø§Ù†ØªØ®Ø§Ø¨ Ø§Ú©Ø§Ù†Øª Ù‡Ù†Ú¯Ø§Ù… Ø§ØªØµØ§Ù„
    UNSTABLE_shimOnConnectSelectAccount: true,
    dappMetadata: { name: 'PSYGStore' },
  }),
  // WalletConnect Ø±Ø§ Ø¨Ù‡â€ŒØµÙˆØ±Øª Ø¢Ù¾Ø´Ù†Ø§Ù„ ÙØ¹Ø§Ù„ Ú©Ù† ØªØ§ Ø¯Ø± dev Ø¨Ø§Ø¹Ø« CORS Ù†Ø´ÙˆØ¯
  ...(ENABLE_WALLETCONNECT
    ? [
        walletConnect({
          projectId: WC_PROJECT_ID,
          // Ø§Ú¯Ø± Ø®ÙˆØ§Ø³ØªÛŒ Ø¢Ù†Ø§Ù„ÛŒØªÛŒÚ©Ø³ WC Ø±Ø§ Ø¨Ø¨Ù†Ø¯ÛŒ (Ø¨Ø¹Ø¶ÛŒ Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§ Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ø¯Ø§Ø±Ù†Ø¯)
          // enableAnalytics: false as any,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors,
  transports: {
    [mainnet.id]: http(MAINNET_RPC),
    [sepolia.id]: http(SEPOLIA_RPC),
  },

  // Ø¯Ø± wagmi v1 Ù…Ø¹Ù†ÛŒâ€ŒØ¯Ø§Ø± Ø§Ø³ØªØ› Ø¯Ø± v2 Ù†Ø§Ø¯ÛŒØ¯Ù‡ Ú¯Ø±ÙØªÙ‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯ Ø§Ù…Ø§ Ø¨ÛŒâ€ŒØ¶Ø±Ø± Ø§Ø³Øª.
  // Ù‡Ø¯Ù: Ø¬Ù„ÙˆÚ¯ÛŒØ±ÛŒ Ø§Ø² Â«Ø§ØªØµØ§Ù„ Ø®ÙˆØ¯Ú©Ø§Ø±Â».
  // @ts-expect-error - wagmi config still relies on legacy autoConnect flag
  autoConnect: false,

  // Ø¯Ø± SSR Ù†ÛŒØ§Ø²ÛŒ Ù†Ø¯Ø§Ø±ÛŒÙ…
  ssr: false,

  // Ø§Ø² Ú©Ø´Ù Ú†Ù†Ø¯ Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡Ù” ØªØ²Ø±ÛŒÙ‚â€ŒØ´Ø¯Ù‡ ØµØ±Ùâ€ŒÙ†Ø¸Ø± Ú©Ù† (reduces noise)
  multiInjectedProviderDiscovery: false,
});

/* =========================
 *  Ù†Ø±Ø® ØªØ¨Ø¯ÛŒÙ„ ØªÙˆÙ…Ø§Ù† â‡„ USDT (Ø¯ÛŒÙ†Ø§Ù…ÛŒÚ© Ø§Ø² Ø¨Ú©â€ŒØ§Ù†Ø¯)
 * ========================= */

/**
 * Ù†Ø±Ø® Ù„Ø­Ø¸Ù‡â€ŒØ§ÛŒ ØªÙˆÙ…Ø§Ù†/USDT Ø±Ø§ Ø§Ø² Ø¨Ú©â€ŒØ§Ù†Ø¯ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù†Ø¯ ( /api/prices/products )
 * Ø§Ú¯Ø± Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†Ø¨ÙˆØ¯ â†’ ÙØ§Ù„Ø¨Ú© 100,000 ØªÙˆÙ…Ø§Ù†.
 */
export async function getTomanPerUsdt(): Promise<number> {
  try {
    const r = await fetch('/api/prices/products', { credentials: 'include' });
    if (!r.ok) throw new Error('bad status');
    const data = await r.json();
    const rate = Number(data?.rate?.tomanPerUsdt);
    return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_TOMAN_PER_USDT;
  } catch {
    return FALLBACK_TOMAN_PER_USDT;
  }
}

/**
 * Ù…Ø¨Ø¯Ù„â€ŒÙ‡Ø§ÛŒ Ø³Ù†Ú©Ø±ÙˆÙ† Ø¨Ø§ Ù†Ø±Ø® ÙˆØ±ÙˆØ¯ÛŒ (Ø¨Ù‡â€ŒØµÙˆØ±Øª Ù¾ÛŒØ´â€ŒÙØ±Ø¶ 100k)
 * Ø§Ú¯Ø± Ù†Ø±Ø® Ù„Ø­Ø¸Ù‡â€ŒØ§ÛŒ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒ Ø§Ø² getTomanPerUsdt() Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†.
 */
export const usdtToToman = (usdtAmount: number, rate = FALLBACK_TOMAN_PER_USDT) =>
  usdtAmount * rate;

export const tomanToUsdt = (tomanAmount: number, rate = FALLBACK_TOMAN_PER_USDT) =>
  tomanAmount / rate;

export const tonToToman = (tonAmount: number, rate = FALLBACK_TOMAN_PER_TON) =>
  tonAmount * rate;

export const tomanToTon = (tomanAmount: number, rate = FALLBACK_TOMAN_PER_TON) =>
  tomanAmount / rate;

/**
 * Async helpers using live exchange rate.
 */
export async function usdtToTomanAsync(usdtAmount: number): Promise<number> {
  const rate = await getTomanPerUsdt();
  return usdtAmount * rate;
}

export async function tomanToUsdtAsync(tomanAmount: number): Promise<number> {
  const rate = await getTomanPerUsdt();
  return tomanAmount / rate;
}

export async function getTomanPerTon(): Promise<number> {
  try {
    const response = await fetch('/api/prices/current', { credentials: 'include' });
    if (!response.ok) throw new Error('bad status');
    const data = await response.json();
    const rate = Number(data?.prices?.TON ?? data?.prices?.ton ?? data?.prices?.Ton);
    return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_TOMAN_PER_TON;
  } catch {
    return FALLBACK_TOMAN_PER_TON;
  }
}

export async function tonToTomanAsync(tonAmount: number): Promise<number> {
  const rate = await getTomanPerTon();
  return tonAmount * rate;
}

export async function tomanToTonAsync(tomanAmount: number): Promise<number> {
  const rate = await getTomanPerTon();
  return tomanAmount / rate;
}

export const tomanToUSDT = tomanToUsdt;
export const tomanToTON = tomanToTon;

export const formatUSDT = (amount: bigint): string =>
  (Number(amount) / 1_000_000).toFixed(2);

export const parseUSDT = (amount: string): bigint =>
  BigInt(Math.floor(parseFloat(amount) * 1_000_000));

/* =========================
 *  Tonkeeper (Ø¨Ø¯ÙˆÙ† ØªØºÛŒÛŒØ± Ø®Ø·Ø±Ù†Ø§Ú©)
 * ========================= */

export const detectTonkeeper = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hasExtension = !!(window as any).tonkeeper || !!(window as any).ton;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return hasExtension || isMobile;
};

export const isTonkeeperReady = (): boolean => {
  if (typeof window === 'undefined') return false;
  const tonkeeper = (window as any).tonkeeper || (window as any).ton;
  return !!tonkeeper;
};

export const waitForTonkeeper = (timeout = 5_000): Promise<boolean> =>
  new Promise((resolve) => {
    if (isTonkeeperReady()) return resolve(true);
    const it = setInterval(() => {
      if (isTonkeeperReady()) {
        clearInterval(it);
        clearTimeout(to);
        resolve(true);
      }
    }, 100);
    const to = setTimeout(() => {
      clearInterval(it);
      resolve(false);
    }, timeout);
  });

export const connectTonkeeper = async (): Promise<string[]> => {
  if (typeof window === 'undefined') throw new Error('Window object not available');

  const ready = await waitForTonkeeper();
  if (!ready) {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    if (isMobile) {
      window.location.href = 'tonkeeper://';
      await new Promise((r) => setTimeout(r, 1000));
      throw new Error('Tonkeeper app not found. Please install Tonkeeper.');
    }
    throw new Error('Tonkeeper wallet not found. Please install Tonkeeper.');
  }

  const tonkeeper = (window as any).tonkeeper || (window as any).ton;

  try {
    const accounts = await tonkeeper.send?.('ton_requestAccounts');
    if (accounts?.length) return accounts;
  } catch {}

  try {
    const result = await tonkeeper.request?.({ method: 'ton_requestAccounts' });
    if (result?.length) return result;
  } catch {}

  try {
    const connected = await tonkeeper.connect?.();
    if (connected?.account?.address) return [connected.account.address];
  } catch {}

  throw new Error('Failed to connect to Tonkeeper. Please try again.');
};

export const getTonkeeperBalance = async (address: string): Promise<string> => {
  if (typeof window === 'undefined') return '0';
  const tonkeeper = (window as any).tonkeeper || (window as any).ton;

  try {
    const b1 = await tonkeeper.send?.('ton_getBalance', [address]);
    if (b1) return (parseFloat(b1) / 1_000_000_000).toFixed(4);
  } catch {}

  try {
    const b2 = await tonkeeper.request?.({
      method: 'ton_getBalance',
      params: [address],
    });
    if (b2) return (parseFloat(b2) / 1_000_000_000).toFixed(4);
  } catch {}

  try {
    const info = await tonkeeper.getAccount?.();
    if (info?.balance) return (parseFloat(info.balance) / 1_000_000_000).toFixed(4);
  } catch {}

  // fallback API (Ù…Ù…Ú©Ù† Ø§Ø³Øª Ù†Ø±Ø® Ù…Ø­Ø¯ÙˆØ¯ÛŒØª/Ú©Ø±Ø§Ø³â€ŒØ§ÙˆØ±ÛŒØ¬ Ø¯Ø§Ø´ØªÙ‡ Ø¨Ø§Ø´Ø¯)
  try {
    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressInformation?address=${address}`
    );
    const data = await resp.json();
    if (data?.ok && data?.result?.balance) {
      return (parseFloat(data.result.balance) / 1_000_000_000).toFixed(4);
    }
  } catch {}

  return '0';
};

export const sendTonTransaction = async (to: string, amountNanoton: string) => {
  if (typeof window === 'undefined') throw new Error('Window object not available');
  const tonkeeper = (window as any).tonkeeper || (window as any).ton;
  if (!tonkeeper) throw new Error('Tonkeeper wallet not found');

  const tx = { to, value: amountNanoton, data: '' };

  try {
    const r1 = await tonkeeper.send?.('ton_sendTransaction', [tx]);
    if (r1) return { hash: r1.hash || r1.txid || r1, success: true };
  } catch {}

  try {
    const r2 = await tonkeeper.request?.({ method: 'ton_sendTransaction', params: [tx] });
    if (r2) return { hash: r2.hash || r2.txid || r2, success: true };
  } catch {}

  try {
    const r3 = await tonkeeper.sendTransaction?.(tx);
    if (r3) return { hash: r3.hash || r3.txid || r3, success: true };
  } catch {}

  throw new Error('Failed to send transaction. Please try again.');
};



