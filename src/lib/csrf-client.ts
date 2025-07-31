import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Token cache for client-side CSRF protection
let csrfTokenCache: { token: string; expires: number } | null = null;

/**
 * Fetches a fresh CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/tokens/security?type=csrf', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No CSRF token received from server');
    }

    // Validate expiresIn value and provide fallback
    const expiresIn = data.expiresIn || data.maxAge || 3600; // Default to 1 hour
    if (typeof expiresIn !== 'number' || expiresIn <= 0) {
      throw new Error(`Invalid expiresIn value: ${expiresIn}`);
    }

    // Cache token with expiration (expires 5 minutes early for safety)
    const expirationTime = Date.now() + (expiresIn - 300) * 1000;
    csrfTokenCache = {
      token: data.token,
      expires: expirationTime,
    };

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
    return csrfTokenCache.token;
  } else {
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

    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
      ...options.headers,
    };

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    const response = await fetch(url, requestOptions);

    // If we get a 403, it might be a CSRF token issue
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));

      // Clear cache and retry once
      csrfTokenCache = null;

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
function clearCSRFTokenCache(): void {
  csrfTokenCache = null;
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
        const token = await getCSRFToken();
        config.headers['X-CSRF-Token'] = token;
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

    // If CSRF validation failed and we haven't already retried
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'CSRF validation failed' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // Clear token and get a new one
        clearCSRFTokenCache();
        const newToken = await getCSRFToken();
        originalRequest.headers['X-CSRF-Token'] = newToken;

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

const secureAxiosPut = (
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

const secureAxiosGet = (
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> => secureAxios.get(url, config);

// Export the secure axios instance for direct use
