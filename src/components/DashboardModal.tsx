import React, { useMemo, useState } from 'react';
import {
  X,
  User,
  Wallet,
  Save,
  LogOut,
  CreditCard,
  Coins,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Payment4Gateway from './Payment4Gateway';
import USDTPayment from './USDTPayment';
import TonPayment from './TonPayment';
import { useNotificationContext } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { hardLogout } from '../lib/auth';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [250_000, 500_000, 1_000_000];

const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, topUpWallet, signOut } = useAuth();
  const { showSuccess, showError } = useNotificationContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>('wallet');
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [tomanAmount, setTomanAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [paymentMethod, setPaymentMethod] = useState<'payment4' | 'usdt' | 'ton'>('payment4');

  const rialBalance = useMemo(() => user?.walletBalanceRial ?? 0, [user]);
  const cryptoBalance = useMemo(() => user?.walletBalanceCrypto ?? 0, [user]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    onClose();
    setActiveTab('wallet');
  };

  const handleProfileSave = async () => {
    if (!displayName.trim()) {
      showError('نام نامعتبر است', 'لطفاً یک نام کامل معتبر وارد کنید.');
      return;
    }

    setIsSavingName(true);
    try {
      await updateProfile({ fullName: displayName.trim() });
      showSuccess('پروفایل به‌روزرسانی شد', 'نام کاربری با موفقیت ذخیره شد.');
    } catch (error: any) {
      console.error('Failed to update profile', error);
      showError('ذخیره انجام نشد', error?.message || 'خطایی در به‌روزرسانی پروفایل رخ داد.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    hardLogout(navigate);
  };

  const handlePaymentSuccess = async (amount: number, method: 'rial' | 'crypto') => {
    try {
      await topUpWallet(amount, method);
    } catch (error) {
      console.error('Failed to sync wallet after payment', error);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <User className="w-4 h-4" /> اطلاعات حساب
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400">نام و نام خانوادگی</label>
            <div className="mt-2 flex gap-2">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="flex-1 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#39ff14]"
                placeholder="نام خود را وارد کنید"
              />
              <button
                onClick={handleProfileSave}
                disabled={isSavingName}
                className="inline-flex items-center gap-2 bg-[#39ff14] text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-lime-300 transition disabled:opacity-70"
              >
                {isSavingName ? 'در حال ذخیره…' : (<><Save className="w-4 h-4" /> ذخیره</>)}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">آدرس ایمیل</label>
            <p className="mt-2 text-sm text-slate-200">{user?.email ?? '---'}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400">روش ورود</label>
            <p className="mt-2 text-sm text-slate-200">{user?.auth_type === 'web3' ? 'کیف پول (Web3)' : 'ایمیل و رمز عبور'}</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Shield className="w-4 h-4" /> امنیت حساب
        </h3>
        <p className="text-xs text-slate-300 leading-6">
          پیشنهاد می‌کنیم برای ورود ایمیل و رمز عبور، رمزهای قوی انتخاب کنید و در صورت استفاده از نسخه اصلی بک‌اند، احراز هویت دومرحله‌ای را فعال نمایید. در نسخه کنونی (محیط لوکال) این گزینه شبیه‌سازی شده است.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-sm font-semibold text-red-300 border border-red-500/40 px-4 py-2 rounded-lg hover:bg-red-500/10 transition"
        >
          <LogOut className="w-4 h-4" /> خروج از حساب کاربری
        </button>
      </div>
    </div>
  );

  const renderWalletTab = () => (
    <div className="space-y-6">
      <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-950/60 border border-slate-700 rounded-lg p-4">
          <h4 className="text-xs text-slate-400">موجودی ریالی</h4>
          <p className="mt-2 text-lg font-bold text-white">{rialBalance.toLocaleString('fa-IR')} تومان</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-700 rounded-lg p-4">
          <h4 className="text-xs text-slate-400">موجودی کریپتو (شبیه‌سازی)</h4>
          <p className="mt-2 text-lg font-bold text-white">{cryptoBalance.toLocaleString('fa-IR')} واحد</p>
        </div>
      </section>

      <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <CreditCard className="w-4 h-4" /> انتخاب مبلغ شارژ
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((value) => (
              <button
                key={value}
                onClick={() => setTomanAmount(value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  tomanAmount === value
                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                    : 'border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                {value.toLocaleString('fa-IR')} تومان
              </button>
            ))}
            <input
              type="number"
              min={100_000}
              value={tomanAmount}
              onChange={(event) => setTomanAmount(Number(event.target.value) || 0)}
              className="w-32 bg-slate-950/70 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[#39ff14]"
            />
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <Coins className="w-4 h-4" /> روش پرداخت
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPaymentMethod('payment4')}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                paymentMethod === 'payment4'
                  ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                  : 'border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              درگاه Payment4
            </button>
            <button
              onClick={() => setPaymentMethod('usdt')}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                paymentMethod === 'usdt'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              پرداخت با USDT
            </button>
            <button
              onClick={() => setPaymentMethod('ton')}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                paymentMethod === 'ton'
                  ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                  : 'border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              پرداخت با TON
            </button>
          </div>
        </div>

        <div>
          {paymentMethod === 'payment4' && (
            <Payment4Gateway
              tomanAmount={tomanAmount}
              onSuccess={(paymentId) => {
                showSuccess('درخواست پرداخت ثبت شد', `شناسه پرداخت: ${paymentId}`);
                handlePaymentSuccess(tomanAmount, 'rial');
              }}
            />
          )}

          {paymentMethod === 'usdt' && (
            <USDTPayment
              tomanAmount={tomanAmount}
              onSuccess={(hash) => {
                showSuccess('پرداخت USDT تایید شد', 'موجودی ریالی شما به‌روز شد.');
                handlePaymentSuccess(tomanAmount, 'rial');
                showSuccess('هش تراکنش', hash);
              }}
              onCancel={() => setPaymentMethod('payment4')}
            />
          )}

          {paymentMethod === 'ton' && (
            <TonPayment
              tomanAmount={tomanAmount}
              onSuccess={(hash) => {
                showSuccess('پرداخت TON ثبت شد', 'پس از تایید شبکه، موجودی به‌روزرسانی شد.');
                handlePaymentSuccess(tomanAmount, 'rial');
                if (hash) {
                  showSuccess('هش تراکنش', hash);
                }
              }}
              onCancel={() => setPaymentMethod('payment4')}
            />
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
      <div className="relative w-full max-w-4xl bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white">
            <Wallet className="w-5 h-5 text-[#39ff14]" />
            <div>
              <p className="text-xs text-slate-400">خوش آمدی،</p>
              <h2 className="text-lg font-semibold">{user?.fullName ?? 'کاربر'}</h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 pt-4">
          <nav className="flex gap-3">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'wallet'
                  ? 'bg-[#39ff14]/20 text-[#39ff14]'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <Wallet className="w-4 h-4" /> کیف پول و شارژ
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'profile'
                  ? 'bg-[#39ff14]/20 text-[#39ff14]'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <User className="w-4 h-4" /> اطلاعات کاربری
            </button>
          </nav>
        </div>

        <main className="px-6 py-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          {activeTab === 'wallet' ? renderWalletTab() : renderProfileTab()}
        </main>
      </div>
    </div>
  );
};

export default DashboardModal;

