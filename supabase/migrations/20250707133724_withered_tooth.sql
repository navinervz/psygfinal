-- PSYGStore MySQL Database Schema
-- Created for MySQL 8.0+ / MariaDB 10.2+

SET FOREIGN_KEY_CHECKS = 0;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) NOT NULL,
  `wallet_balance_rial` bigint(20) DEFAULT 0,
  `wallet_balance_crypto` decimal(20,8) DEFAULT 0.00000000,
  `wallet_address` varchar(255) DEFAULT NULL,
  `auth_type` enum('email','web3') DEFAULT 'email',
  `is_admin` boolean DEFAULT false,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_wallet_address` (`wallet_address`),
  KEY `idx_auth_type` (`auth_type`),
  KEY `idx_is_admin` (`is_admin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `user_id` varchar(36) NOT NULL,
  `product_id` varchar(100) NOT NULL,
  `option_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `total_price` bigint(20) NOT NULL,
  `status` enum('pending','processing','completed','failed','cancelled','refunded') DEFAULT 'pending',
  `telegram_id` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Articles table
CREATE TABLE IF NOT EXISTS `articles` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `title` varchar(500) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `excerpt` text,
  `content` longtext,
  `image_url` varchar(500) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `read_time` int(11) DEFAULT NULL,
  `keywords` json DEFAULT NULL,
  `meta_description` text,
  `published_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_category` (`category`),
  KEY `idx_published_at` (`published_at`),
  FULLTEXT KEY `ft_title_content` (`title`,`content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment requests table (ZarinPal)
CREATE TABLE IF NOT EXISTS `payment_requests` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `user_id` varchar(36) NOT NULL,
  `authority` varchar(255) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `description` text,
  `order_id` varchar(36) DEFAULT NULL,
  `status` enum('pending','completed','failed','cancelled') DEFAULT 'pending',
  `ref_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `authority` (`authority`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `fk_payment_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crypto payment requests table (Payment4)
CREATE TABLE IF NOT EXISTS `crypto_payment_requests` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `user_id` varchar(36) NOT NULL,
  `payment_id` varchar(255) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `currency` varchar(10) NOT NULL,
  `description` text,
  `order_id` varchar(36) DEFAULT NULL,
  `status` enum('pending','completed','failed','expired','cancelled') DEFAULT 'pending',
  `wallet_address` varchar(255) NOT NULL,
  `transaction_hash` varchar(255) DEFAULT NULL,
  `exchange_rate` decimal(15,2) DEFAULT 65000.00,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_id` (`payment_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_currency` (`currency`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `fk_crypto_payment_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coupons table
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `code` varchar(50) NOT NULL,
  `type` enum('percentage','fixed') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `min_amount` bigint(20) DEFAULT 0,
  `max_discount` bigint(20) DEFAULT NULL,
  `usage_limit` int(11) DEFAULT NULL,
  `used_count` int(11) DEFAULT 0,
  `valid_from` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `valid_until` timestamp NULL DEFAULT NULL,
  `is_active` boolean DEFAULT true,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_valid_until` (`valid_until`),
  CONSTRAINT `fk_coupons_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coupon usage table
CREATE TABLE IF NOT EXISTS `coupon_usage` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `coupon_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `order_id` varchar(36) DEFAULT NULL,
  `discount_amount` bigint(20) NOT NULL,
  `used_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coupon_id` (`coupon_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `fk_coupon_usage_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coupon_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coupon_usage_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin logs table
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `admin_id` varchar(36) NOT NULL,
  `action` varchar(255) NOT NULL,
  `target_type` varchar(100) DEFAULT NULL,
  `target_id` varchar(36) DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_admin_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user
INSERT IGNORE INTO `users` (`id`, `email`, `full_name`, `is_admin`, `auth_type`) VALUES
(UUID(), 'admin@psygstore.com', 'مدیر سیستم', true, 'email');

-- Insert sample articles
INSERT IGNORE INTO `articles` (`id`, `title`, `slug`, `excerpt`, `content`, `image_url`, `category`, `read_time`, `keywords`, `meta_description`) VALUES
(UUID(), 'راهنمای جامع استفاده از تلگرام پریمیوم: امکانات ویژه و نحوه فعال‌سازی', 'telegram-premium-guide', 'در این مقاله به بررسی تمامی امکانات تلگرام پریمیوم و نحوه استفاده از آن‌ها می‌پردازیم.', 'محتوای کامل مقاله تلگرام پریمیوم...', 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg', 'تلگرام', 8, JSON_ARRAY('تلگرام پریمیوم', 'خرید تلگرام پریمیوم'), 'راهنمای کامل خرید و استفاده از تلگرام پریمیوم'),

(UUID(), 'بهینه‌سازی پلی‌لیست‌های اسپاتیفای: راهنمای کامل مدیریت موسیقی', 'spotify-playlist-optimization', 'چگونه پلی‌لیست‌های خود را در اسپاتیفای سازماندهی کنیم و از الگوریتم‌های پیشنهادی آن بهره ببریم.', 'محتوای کامل مقاله اسپاتیفای...', 'https://images.pexels.com/photos/164745/pexels-photo-164745.jpeg', 'اسپاتیفای', 6, JSON_ARRAY('اسپاتیفای', 'پلی لیست', 'موسیقی'), 'راهنمای کامل بهینه‌سازی پلی‌لیست‌های اسپاتیفای'),

(UUID(), 'ترفندهای پیشرفته چت جی‌پی‌تی: راهنمای مهندسی پرامپت', 'chatgpt-advanced-prompts', 'با استفاده از تکنیک‌های مهندسی پرامپت، می‌توانید خروجی‌های هوشمندتر و دقیق‌تری از چت جی‌پی‌تی دریافت کنید.', 'محتوای کامل مقاله چت جی‌پی‌تی...', 'https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg', 'هوش مصنوعی', 10, JSON_ARRAY('چت جی پی تی', 'هوش مصنوعی', 'مهندسی پرامپت'), 'راهنمای کامل مهندسی پرامپت برای چت جی‌پی‌تی');

-- Insert sample coupons
INSERT IGNORE INTO `coupons` (`id`, `code`, `type`, `value`, `min_amount`, `usage_limit`, `valid_until`) VALUES
(UUID(), 'WELCOME10', 'percentage', 10.00, 100000, 100, DATE_ADD(NOW(), INTERVAL 30 DAY)),
(UUID(), 'SAVE50K', 'fixed', 50000.00, 500000, 50, DATE_ADD(NOW(), INTERVAL 15 DAY));

SET FOREIGN_KEY_CHECKS = 1;