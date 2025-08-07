import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Currency utility functions for formatting money amounts
 * All internal calculations should use cents, only convert to dollars for display
 */

/**
 * Convert cents to dollars for display purposes only
 * @param cents - Amount in cents
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(
  cents: number,
  currency: string = 'USD'
): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Convert cents to dollars as a number for display calculations
 * Use this when you need the numeric value for display logic only
 * @param cents - Amount in cents
 * @returns Dollars as number with 2 decimal places
 */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Convert dollars to cents for internal calculations
 * Use this when receiving user input in dollars
 * @param dollars - Amount in dollars
 * @returns Cents as integer
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
