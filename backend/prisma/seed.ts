import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123456', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@psygstore.com' },
    update: {},
    create: {
      email: 'admin@psygstore.com',
      fullName: 'مدیر سیستم',
      passwordHash: adminPasswordHash,
      authType: 'EMAIL',
      isAdmin: true,
      emailVerified: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample articles
  const articles = [
    {
      title: 'راهنمای جامع استفاده از تلگرام پریمیوم: امکانات ویژه و نحوه فعال‌سازی',
      slug: 'telegram-premium-guide',
      excerpt: 'در این مقاله به بررسی تمامی امکانات تلگرام پریمیوم و نحوه استفاده از آن‌ها می‌پردازیم. از ارسال پیام‌های طولانی تا افزایش سرعت دانلود، اتصال به چندین اکانت و دسترسی به استیکرهای انحصاری.',
      content: `# راهنمای جامع استفاده از تلگرام پریمیوم

## مقدمه
تلگرام پریمیوم نسخه پیشرفته و پولی تلگرام است که امکانات فوق‌العاده‌ای را در اختیار کاربران قرار می‌دهد.

## امکانات کلیدی
- ارسال فایل‌های تا 4 گیگابایت
- پیام‌های تا 4000 کاراکتر
- سرعت دانلود بالاتر
- استیکرهای انحصاری

## نحوه فعال‌سازی
برای فعال‌سازی تلگرام پریمیوم می‌توانید از فروشگاه ما استفاده کنید.`,
      imageUrl: 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1',
      category: 'تلگرام',
      readTime: 8,
      keywords: ['تلگرام پریمیوم', 'خرید تلگرام پریمیوم', 'امکانات تلگرام پریمیوم'],
      metaDescription: 'راهنمای کامل خرید و استفاده از تلگرام پریمیوم. بررسی امکانات، نحوه فعال‌سازی و مزایای اشتراک تلگرام پریمیوم.',
      authorId: admin.id,
    },
    {
      title: 'بهینه‌سازی پلی‌لیست‌های اسپاتیفای: راهنمای کامل مدیریت موسیقی',
      slug: 'spotify-playlist-optimization',
      excerpt: 'چگونه پلی‌لیست‌های خود را در اسپاتیفای سازماندهی کنیم و از الگوریتم‌های پیشنهادی آن بهره ببریم. با روش‌های حرفه‌ای مدیریت موسیقی آشنا شوید.',
      content: `# بهینه‌سازی پلی‌لیست‌های اسپاتیفای

## مقدمه
اسپاتیفای یکی از محبوب‌ترین پلتفرم‌های پخش موسیقی در جهان است.

## استراتژی‌های ایجاد پلی‌لیست
- دسته‌بندی بر اساس ژانر
- دسته‌بندی بر اساس حال و هوا
- استفاده از الگوریتم اسپاتیفای

## نکات حرفه‌ای
برای بهره‌برداری بهینه از اسپاتیفای، خرید اشتراک پریمیوم ضروری است.`,
      imageUrl: 'https://images.pexels.com/photos/164745/pexels-photo-164745.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1',
      category: 'اسپاتیفای',
      readTime: 6,
      keywords: ['اسپاتیفای', 'پلی لیست', 'موسیقی', 'اشتراک اسپاتیفای'],
      metaDescription: 'راهنمای کامل بهینه‌سازی پلی‌لیست‌های اسپاتیفای. نحوه سازماندهی موسیقی و خرید اشتراک اسپاتیفای.',
      authorId: admin.id,
    },
    {
      title: 'ترفندهای پیشرفته چت جی‌پی‌تی: راهنمای مهندسی پرامپت',
      slug: 'chatgpt-advanced-prompts',
      excerpt: 'با استفاده از تکنیک‌های مهندسی پرامپت، می‌توانید خروجی‌های هوشمندتر و دقیق‌تری از چت جی‌پی‌تی دریافت کنید.',
      content: `# ترفندهای پیشرفته چت جی‌پی‌تی

## مقدمه
چت جی‌پی‌تی یکی از پیشرفته‌ترین مدل‌های هوش مصنوعی است.

## تکنیک‌های مهندسی پرامپت
- Chain of Thought
- Role Playing
- Few-Shot Learning

## کاربردهای عملی
برای دسترسی به نسخه پیشرفته چت جی‌پی‌تی، خرید اشتراک ضروری است.`,
      imageUrl: 'https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1',
      category: 'هوش مصنوعی',
      readTime: 10,
      keywords: ['چت جی پی تی', 'هوش مصنوعی', 'مهندسی پرامپت', 'ChatGPT'],
      metaDescription: 'راهنمای کامل مهندسی پرامپت برای چت جی‌پی‌تی. تکنیک‌های پیشرفته و نحوه خرید اشتراک ChatGPT.',
      authorId: admin.id,
    },
  ];

  for (const articleData of articles) {
    await prisma.article.upsert({
      where: { slug: articleData.slug },
      update: {},
      create: articleData,
    });
  }

  console.log('✅ Sample articles created');

  // Create sample coupons
  const coupons = [
    {
      code: 'WELCOME10',
      type: 'PERCENTAGE' as const,
      value: 10,
      minAmount: 100000,
      usageLimit: 100,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdBy: admin.id,
    },
    {
      code: 'SAVE50K',
      type: 'FIXED' as const,
      value: 50000,
      minAmount: 500000,
      usageLimit: 50,
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      createdBy: admin.id,
    },
    {
      code: 'NEWUSER',
      type: 'PERCENTAGE' as const,
      value: 15,
      minAmount: 200000,
      usageLimit: 200,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      createdBy: admin.id,
    },
  ];

  for (const couponData of coupons) {
    await prisma.coupon.upsert({
      where: { code: couponData.code },
      update: {},
      create: couponData,
    });
  }

  console.log('✅ Sample coupons created');

  // Create initial crypto prices
  const initialPrices = [
    { currency: 'USDT', priceIrt: 65000 },
    { currency: 'BTC', priceIrt: 2600000000 },
    { currency: 'ETH', priceIrt: 160000000 },
    { currency: 'TON', priceIrt: 300000 },
  ];

  for (const priceData of initialPrices) {
    await prisma.cryptoPrice.upsert({
      where: { currency: priceData.currency },
      update: { priceIrt: priceData.priceIrt },
      create: priceData,
    });
  }

  console.log('✅ Initial crypto prices set');

  console.log('🎉 Database seeding completed!');
  console.log('📧 Admin login: admin@psygstore.com');
  console.log('🔑 Admin password: admin123456');
  console.log('⚠️  Please change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });