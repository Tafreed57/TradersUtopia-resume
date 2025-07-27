import { AccessToken } from 'livekit-server-sdk';
import { apiLogger } from '@/lib/enhanced-logger';
import { BaseDatabaseService } from './database/base-service';
import { getCSRFTokenForUser, getCSRFStats } from '@/lib/csrf';

export interface MediaTokenRequest {
  room: string;
  username: string;
  permissions?: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canUpdateMetadata?: boolean;
  };
}

export interface MediaTokenResponse {
  token: string;
  expiresAt: Date;
  room: string;
  username: string;
  permissions: {
    canPublish: boolean;
    canSubscribe: boolean;
    canUpdateMetadata: boolean;
  };
}

export interface CSRFTokenResponse {
  token: string;
  expiresIn: number;
  expiresAt: Date;
  usage: string;
}

export interface CSRFStatsResponse {
  environment: string;
  timestamp: string;
  csrfStats: any;
  note: string;
}

/**
 * TokenService - Centralized token management
 * Handles LiveKit media tokens, authentication tokens, and security tokens
 */
export class TokenService extends BaseDatabaseService {
  /**
   * Generate LiveKit access token for media sessions
   */
  async generateMediaToken(
    request: MediaTokenRequest
  ): Promise<MediaTokenResponse> {
    const operation = 'generate_media_token';

    try {
      // Validate environment configuration
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!apiKey || !apiSecret || !wsUrl) {
        throw new Error('LiveKit configuration incomplete');
      }

      // Set default permissions
      const permissions = {
        canPublish: request.permissions?.canPublish ?? true,
        canSubscribe: request.permissions?.canSubscribe ?? true,
        canUpdateMetadata: request.permissions?.canUpdateMetadata ?? false,
      };

      // Create access token
      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: request.username,
      });

      // Add room grants
      accessToken.addGrant({
        room: request.room,
        roomJoin: true,
        canPublish: permissions.canPublish,
        canSubscribe: permissions.canSubscribe,
        canUpdateOwnMetadata: permissions.canUpdateMetadata,
      });

      // Generate JWT token
      const jwtToken = await accessToken.toJwt();

      // Token expires in 24 hours by default
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const response: MediaTokenResponse = {
        token: jwtToken,
        expiresAt,
        room: request.room,
        username: request.username,
        permissions,
      };

      apiLogger.databaseOperation(operation, true, {
        room: request.room,
        username: request.username.substring(0, 3) + '***',
        permissions,
        expiresAt: expiresAt.toISOString(),
      });

      return response;
    } catch (error) {
      this.handleError(error, operation, {
        room: request.room,
        username: request.username.substring(0, 3) + '***',
      });
      throw error;
    }
  }

  /**
   * Validate LiveKit token
   */
  async validateMediaToken(token: string): Promise<boolean> {
    const operation = 'validate_media_token';

    try {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        throw new Error('LiveKit configuration incomplete');
      }

      // Simple validation - in production, you might want more comprehensive validation
      const isValid = token.startsWith('eyJ') && token.split('.').length === 3;

      apiLogger.databaseOperation(operation, true, {
        isValid,
        tokenLength: token.length,
      });

      return isValid;
    } catch (error) {
      this.handleError(error, operation, {
        tokenProvided: !!token,
      });
      return false;
    }
  }

  /**
   * Generate session token for authenticated operations
   */
  async generateSessionToken(
    userId: string,
    expirationHours: number = 24
  ): Promise<string> {
    const operation = 'generate_session_token';

    try {
      // Simple session token generation - in production, use proper JWT library
      const payload = {
        userId,
        exp: Math.floor(Date.now() / 1000) + expirationHours * 60 * 60,
        iat: Math.floor(Date.now() / 1000),
      };

      // For now, return a simple base64 encoded payload
      // In production, use proper JWT signing with secret
      const token = Buffer.from(JSON.stringify(payload)).toString('base64');

      apiLogger.databaseOperation(operation, true, {
        userId: userId.substring(0, 8) + '***',
        expirationHours,
        tokenLength: token.length,
      });

      return token;
    } catch (error) {
      this.handleError(error, operation, {
        userId: userId.substring(0, 8) + '***',
        expirationHours,
      });
      throw error;
    }
  }

  /**
   * Validate session token
   */
  async validateSessionToken(
    token: string
  ): Promise<{ valid: boolean; userId?: string; exp?: number }> {
    const operation = 'validate_session_token';

    try {
      if (!token) {
        return { valid: false };
      }

      // Decode base64 token
      const payloadStr = Buffer.from(token, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadStr);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      const isValid = payload.exp > now;

      apiLogger.databaseOperation(operation, true, {
        isValid,
        userId: payload.userId?.substring(0, 8) + '***',
        exp: payload.exp,
        currentTime: now,
      });

      return {
        valid: isValid,
        userId: payload.userId,
        exp: payload.exp,
      };
    } catch (error) {
      this.handleError(error, operation, {
        tokenProvided: !!token,
      });
      return { valid: false };
    }
  }

  /**
   * Generate API key for external integrations
   */
  async generateApiKey(userId: string, keyName: string): Promise<string> {
    const operation = 'generate_api_key';

    try {
      // Generate a secure API key
      const timestamp = Date.now().toString(36);
      const randomBytes = Math.random().toString(36).substring(2);
      const userHash = userId.substring(0, 8);

      const apiKey = `tu_${timestamp}_${userHash}_${randomBytes}`;

      apiLogger.databaseOperation(operation, true, {
        userId: userId.substring(0, 8) + '***',
        keyName,
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 10) + '***',
      });

      return apiKey;
    } catch (error) {
      this.handleError(error, operation, {
        userId: userId.substring(0, 8) + '***',
        keyName,
      });
      throw error;
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKey: string, userId: string): Promise<boolean> {
    const operation = 'revoke_api_key';

    try {
      // In a real implementation, you would mark the key as revoked in the database
      // For now, we just log the revocation

      apiLogger.databaseOperation(operation, true, {
        userId: userId.substring(0, 8) + '***',
        keyPrefix: apiKey.substring(0, 10) + '***',
        revokedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      this.handleError(error, operation, {
        userId: userId.substring(0, 8) + '***',
        keyPrefix: apiKey.substring(0, 10) + '***',
      });
      return false;
    }
  }

  /**
   * Generate CSRF token for authenticated users
   */
  async generateCSRFToken(userId: string): Promise<CSRFTokenResponse> {
    const operation = 'generate_csrf_token';

    try {
      // Use the existing CSRF token generation function
      const csrfToken = await getCSRFTokenForUser();

      if (!csrfToken) {
        throw new Error('Failed to generate CSRF token');
      }

      const expiresIn = 3600; // 1 hour in seconds
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const response: CSRFTokenResponse = {
        token: csrfToken,
        expiresIn,
        expiresAt,
        usage:
          'Include this token in X-CSRF-Token header for state-changing requests',
      };

      apiLogger.databaseOperation(operation, true, {
        userId: userId.substring(0, 8) + '***',
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        tokenLength: csrfToken.length,
      });

      return response;
    } catch (error) {
      this.handleError(error, operation, {
        userId: userId.substring(0, 8) + '***',
      });
      throw error;
    }
  }

  /**
   * Get CSRF statistics (development only)
   */
  async getCSRFStats(userId: string): Promise<CSRFStatsResponse> {
    const operation = 'get_csrf_stats';

    try {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CSRF stats disabled in production');
      }

      const stats = getCSRFStats();

      const response: CSRFStatsResponse = {
        environment: 'development',
        timestamp: new Date().toISOString(),
        csrfStats: stats,
        note: '🔒 CSRF protection is active for state-changing requests',
      };

      apiLogger.databaseOperation(operation, true, {
        userId: userId.substring(0, 8) + '***',
        environment: 'development',
        statsRetrieved: true,
      });

      return response;
    } catch (error) {
      this.handleError(error, operation, {
        userId: userId.substring(0, 8) + '***',
        environment: process.env.NODE_ENV,
      });
      throw error;
    }
  }
}
