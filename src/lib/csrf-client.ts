// ✅ CSRF Client-Side Protection System
// This module provides client-side CSRF protection for frontend API calls

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// ✅ SECURITY: Debug mode for CSRF operations
// Set to true temporarily if you need to debug CSRF issues
const DEBUG_CSRF = process.env.NODE_ENV === 'development' && false; // Temporarily disabled

// Token cache for client-side CSRF protection
let csrfTokenCache: { token: string; expires: number } | null = null;

/**
 * Fetches a fresh CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  try {
    if (DEBUG_CSRF)
      console.log('🔄 [CSRF] Fetching new CSRF token from server...');

    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (DEBUG_CSRF)
      console.log('📡 [CSRF] Token fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();

    if (DEBUG_CSRF) {
      console.log('📋 [CSRF] Token response data:', {
        hasToken: !!data.token,
        tokenLength: data.token?.length,
        expiresIn: data.expiresIn,
      });
    }

    if (!data.token) {
      throw new Error('No CSRF token received from server');
    }

    // Cache token with expiration (expires 5 minutes early for safety)
    csrfTokenCache = {
      token: data.token,
      expires: Date.now() + (data.expiresIn - 300) * 1000,
    };

    if (DEBUG_CSRF) {
      console.log(
        '✅ [CSRF] Token cached successfully, expires:',
        new Date(csrfTokenCache.expires).toISOString()
      );
    }

    return data.token;
  } catch (error) {
    console.error('🚨 [CSRF] Failed to fetch CSRF token:', error);
    throw error;
  }
}

/**
 * Gets a valid CSRF token, fetching a new one if needed
 */
async function getCSRFToken(): Promise<string> {
  // Check if we have a valid cached token
  if (
    csrfTokenCache &&
    csrfTokenCache.expires > Date.now() &&
    csrfTokenCache.token
  ) {
    if (DEBUG_CSRF)
      console.log('🔄 [CSRF] Token missing or expiring, fetching new token...');
    return csrfTokenCache.token;
  } else {
    if (DEBUG_CSRF) console.log('✅ [CSRF] Using cached token');
    return await fetchCSRFToken();
  }
}

/**
 * Makes a secure request with automatic CSRF protection
 */
export async function makeSecureRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const token = await getCSRFToken();

    if (DEBUG_CSRF) console.log('🔒 [CSRF] Making secure request to:', url);

    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
      ...options.headers,
    };

    if (DEBUG_CSRF) {
      console.log('🎫 [CSRF] Using token:', token.substring(0, 8) + '...');
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    if (DEBUG_CSRF) {
      console.log('📤 [CSRF] Request headers:', {
        hasCSRF: !!headers['X-CSRF-Token'],
        contentType: headers['Content-Type'],
        method: options.method || 'GET',
      });
    }

    const response = await fetch(url, requestOptions);

    if (DEBUG_CSRF) console.log('📥 [CSRF] Response status:', response.status);

    // If we get a 403, it might be a CSRF token issue
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      if (DEBUG_CSRF) console.log('⚠️ [CSRF] 403 response data:', errorData);

      if (DEBUG_CSRF) {
        console.log(
          '🔄 [CSRF] 403 error detected, clearing token cache and retrying...'
        );
      }

      // Clear cache and retry once
      csrfTokenCache = null;

      if (DEBUG_CSRF) {
        console.log('♻️ [CSRF] Retrying request with fresh token...');
      }

      const newToken = await getCSRFToken();
      const retryHeaders = {
        ...headers,
        'X-CSRF-Token': newToken,
      };

      return await fetch(url, {
        ...requestOptions,
        headers: retryHeaders,
      });
    }

    return response;
  } catch (error) {
    console.error('🚨 [CSRF] Secure request failed:', error);
    throw error;
  }
}

/**
 * Clears the cached CSRF token (forces refresh on next request)
 */
export function clearCSRFTokenCache(): void {
  csrfTokenCache = null;
  if (DEBUG_CSRF) console.log('🧹 [CSRF] Token cache cleared');
}

// ============================================================================
// SECURE AXIOS WRAPPER
// ============================================================================

// Create axios instance with default config
const secureAxios = axios.create({
  withCredentials: true,
});

// Add request interceptor to include CSRF token
secureAxios.interceptors.request.use(
  async config => {
    // Only add CSRF token for state-changing methods
    if (
      ['post', 'put', 'patch', 'delete'].includes(
        config.method?.toLowerCase() || ''
      )
    ) {
      try {
        if (DEBUG_CSRF)
          console.log(
            '🔒 [AXIOS] Adding CSRF token to request:',
            config.method?.toUpperCase(),
            config.url
          );
        const token = await getCSRFToken();
        config.headers['X-CSRF-Token'] = token;
        if (DEBUG_CSRF)
          console.log('🎫 [AXIOS] Token added:', token.substring(0, 8) + '...');
      } catch (error) {
        console.error(
          '🚨 [CSRF] Failed to add CSRF token to axios request:',
          error
        );
        throw error;
      }
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle CSRF validation failures
secureAxios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (DEBUG_CSRF)
      console.log(
        '⚠️ [AXIOS] Request failed:',
        error.response?.status,
        error.response?.data
      );

    // If CSRF validation failed and we haven't already retried
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'CSRF validation failed' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      console.log(
        '🔄 [CSRF] CSRF validation failed, retrying with new token...'
      );

      try {
        // Clear token and get a new one
        clearCSRFTokenCache();
        const newToken = await getCSRFToken();
        originalRequest.headers['X-CSRF-Token'] = newToken;

        if (DEBUG_CSRF)
          console.log(
            '🔁 [AXIOS] Retrying with new token:',
            newToken.substring(0, 8) + '...'
          );

        // Retry the request
        return secureAxios(originalRequest);
      } catch (retryError) {
        console.error(
          '🚨 [CSRF] Failed to retry request with new token:',
          retryError
        );
        return Promise.reject(retryError);
      }
    }

    return Promise.reject(error);
  }
);

// Export axios methods with CSRF protection
export const secureAxiosPost = (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.post(url, data, config);

export const secureAxiosPut = (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.put(url, data, config);

export const secureAxiosPatch = (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.patch(url, data, config);

export const secureAxiosDelete = (
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.delete(url, config);

export const secureAxiosGet = (
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.get(url, config);

// Export the secure axios instance for direct use
export { secureAxios };
