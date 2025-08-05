'use client';

/**
 * @deprecated This hook has been replaced by the optimized session provider.
 * Please use the new useExtendedUser from '@/contexts/session-provider' instead.
 *
 * This compatibility layer redirects to the new implementation.
 */

// Re-export the new optimized hook for backward compatibility
export { useExtendedUser } from '@/contexts/session-provider';
