// ✅ CSRF Client-Side Protection System
// This module provides client-side CSRF protection for frontend API calls

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

let csrfToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

// Debug flag to control logging
const DEBUG_CSRF = process.env.NODE_ENV === 'development' && false; // Temporarily disabled

/**
 * Fetches a fresh CSRF token from the server
 */
export async function fetchCsrfToken(): Promise<string> {
  try {
    if (DEBUG_CSRF) console.log('🔄 [CSRF] Fetching new CSRF token from server...');
    
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (DEBUG_CSRF) console.log('📡 [CSRF] Token fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();
    if (DEBUG_CSRF) console.log('📋 [CSRF] Token response data:', { hasToken: !!data.token, maxAge: data.maxAge });
    
    if (!data.token) {
      throw new Error('No CSRF token received from server');
    }

    csrfToken = data.token;
    tokenExpiry = Date.now() + (data.maxAge * 1000);
    
    if (DEBUG_CSRF) console.log('✅ [CSRF] Token cached successfully, expires at:', new Date(tokenExpiry).toISOString());
    return data.token;
  } catch (error) {
    console.error('🚨 [CSRF] Failed to fetch CSRF token:', error);
    throw new Error('Failed to obtain security token. Please refresh the page.');
  }
}

/**
 * Gets a valid CSRF token, fetching a new one if needed
 */
export async function getCsrfToken(): Promise<string> {
  // Check if we need a new token
  if (!csrfToken || Date.now() >= (tokenExpiry - TOKEN_REFRESH_BUFFER)) {
    if (DEBUG_CSRF) console.log('🔄 [CSRF] Token missing or expiring, fetching new token...');
    await fetchCsrfToken();
  } else {
    if (DEBUG_CSRF) console.log('✅ [CSRF] Using cached token');
  }
  
  return csrfToken!;
}

/**
 * Makes a secure request with automatic CSRF protection
 */
export async function makeSecureRequest(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    if (DEBUG_CSRF) console.log('🔒 [CSRF] Making secure request to:', url);
    
    // Get CSRF token
    const token = await getCsrfToken();
    if (DEBUG_CSRF) console.log('🎫 [CSRF] Using token:', token.substring(0, 8) + '...');
    
    // Prepare headers with CSRF token
    const headers = new Headers(options.headers);
    headers.set('X-CSRF-Token', token);
    
    if (DEBUG_CSRF) {
      console.log('📤 [CSRF] Request headers:', {
        'X-CSRF-Token': token.substring(0, 8) + '...',
        'Content-Type': headers.get('Content-Type')
      });
    }
    
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (DEBUG_CSRF) console.log('📥 [CSRF] Response status:', response.status);

    // If CSRF validation failed, clear token and retry once
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      if (DEBUG_CSRF) console.log('⚠️ [CSRF] 403 response data:', errorData);
      
      if (errorData.error === 'CSRF validation failed') {
        console.log('🔄 [CSRF] Token invalid, fetching new token and retrying...');
        clearCsrfToken();
        const newToken = await getCsrfToken();
        headers.set('X-CSRF-Token', newToken);
        
        if (DEBUG_CSRF) console.log('🔁 [CSRF] Retrying with new token:', newToken.substring(0, 8) + '...');
        
        return fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
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
export function clearCsrfToken(): void {
  csrfToken = null;
  tokenExpiry = 0;
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
  async (config) => {
    // Only add CSRF token for state-changing methods
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      try {
        if (DEBUG_CSRF) console.log('🔒 [AXIOS] Adding CSRF token to request:', config.method?.toUpperCase(), config.url);
        const token = await getCsrfToken();
        config.headers['X-CSRF-Token'] = token;
        if (DEBUG_CSRF) console.log('🎫 [AXIOS] Token added:', token.substring(0, 8) + '...');
      } catch (error) {
        console.error('🚨 [CSRF] Failed to add CSRF token to axios request:', error);
        throw error;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle CSRF validation failures
secureAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (DEBUG_CSRF) console.log('⚠️ [AXIOS] Request failed:', error.response?.status, error.response?.data);
    
    // If CSRF validation failed and we haven't already retried
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'CSRF validation failed' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      console.log('🔄 [CSRF] CSRF validation failed, retrying with new token...');
      
      try {
        // Clear token and get a new one
        clearCsrfToken();
        const newToken = await getCsrfToken();
        originalRequest.headers['X-CSRF-Token'] = newToken;
        
        if (DEBUG_CSRF) console.log('🔁 [AXIOS] Retrying with new token:', newToken.substring(0, 8) + '...');
        
        // Retry the request
        return secureAxios(originalRequest);
      } catch (retryError) {
        console.error('🚨 [CSRF] Failed to retry request with new token:', retryError);
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export axios methods with CSRF protection
export const secureAxiosPost = (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
  secureAxios.post(url, data, config);

export const secureAxiosPut = (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
  secureAxios.put(url, data, config);

export const secureAxiosPatch = (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
  secureAxios.patch(url, data, config);

export const secureAxiosDelete = (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
  secureAxios.delete(url, config);

export const secureAxiosGet = (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
  secureAxios.get(url, config);

// Export the secure axios instance for direct use
export { secureAxios }; 