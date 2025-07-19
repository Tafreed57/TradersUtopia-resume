/**
 * ✅ UPDATED: All Premium Trading Alert Product IDs
 * These are all the products that should have access to trade alerts
 *
 * This file contains only configuration constants and can be safely imported
 * in both client and server components.
 */
export const TRADING_ALERT_PRODUCTS = [
  'prod_SDiGAAqaeO0evl', // Premium Trading Alerts Product 1
  'prod_SCHs4JlyD7gXtP', // Premium Trading Alerts Product 2
  'prod_Qw1H4GoEIfftjk', // Premium Trading Alerts Product 3
  'prod_QiTgT5kRBYkTow', // Premium Trading Alerts Product 4
  'prod_QhRSRDcYmiwNPQ', // Premium Trading Alerts Product 5
  'prod_PjwDEddsi171yy', // Premium Trading Alerts Product 6
  'prod_PWrdZSGb1DPJR9', // Premium Trading Alerts Product 7
  'prod_SWIyAf2tfVrJao', // Premium Trading Alerts Product 8
] as const;

/**
 * Common product ID configurations
 * Define your product tiers here for easy reuse
 */
export const PRODUCT_TIERS = {
  // ✅ UPDATED: All products that provide trade alert access
  TRADING_ALERTS: TRADING_ALERT_PRODUCTS,

  // Dashboard access (includes all trading alert products)
  DASHBOARD_ACCESS: TRADING_ALERT_PRODUCTS,

  // Server access (includes all trading alert products)
  SERVER_ACCESS: TRADING_ALERT_PRODUCTS,

  // Example configurations for when you add more products
  // BASIC: ['prod_basic_monthly', 'prod_basic_yearly'],
  // PREMIUM: ['prod_premium_monthly', 'prod_premium_yearly'],
  // VIP: ['prod_vip_monthly', 'prod_vip_yearly'],
  // LIFETIME: ['prod_lifetime_access'],

  // Combined tiers (user with any of these gets access)
  ALL_PREMIUM: TRADING_ALERT_PRODUCTS,
} as const;

/**
 * Type definitions for product IDs
 */
export type TradingAlertProduct = (typeof TRADING_ALERT_PRODUCTS)[number];
export type ProductTier = keyof typeof PRODUCT_TIERS;
