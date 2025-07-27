/**
 * CustomerService Unit Tests
 *
 * Comprehensive test suite for the CustomerService covering:
 * - Core functionality (findCustomerByEmail, createCustomer, etc.)
 * - Error handling (Stripe API errors, validation errors)
 * - Security (data masking, input validation)
 * - Business logic (upsert operations, subscription summaries)
 * - Edge cases (deleted customers, empty results)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CustomerService } from '@/services/stripe/customer-service';
import { mockStripe, mockLogger, createMockStripeCustomer } from '../../setup';
import { ExternalServiceError, ValidationError } from '@/lib/error-handling';

describe('CustomerService', () => {
  let customerService: CustomerService;

  beforeEach(() => {
    customerService = new CustomerService();
  });

  describe('findCustomerByEmail', () => {
    it('should find customer by email successfully', async () => {
      // Arrange
      const mockCustomer = createMockStripeCustomer({
        email: 'test@example.com',
      });
      mockStripe.customers.list.mockResolvedValue({
        data: [mockCustomer],
        has_more: false,
      });

      // Act
      const result =
        await customerService.findCustomerByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: 'test@example.com',
        limit: 1,
      });
      expect(mockLogger.databaseOperation).toHaveBeenCalledWith(
        'stripe_find_customer_by_email_success',
        true,
        expect.objectContaining({
          email: 'tes***',
        })
      );
    });

    it('should return null when customer not found', async () => {
      // Arrange
      mockStripe.customers.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      // Act
      const result = await customerService.findCustomerByEmail(
        'notfound@example.com'
      );

      // Assert
      expect(result).toBeNull();
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: 'notfound@example.com',
        limit: 1,
      });
    });

    it('should handle Stripe API errors', async () => {
      // Arrange
      const stripeError = new Error('Stripe API Error');
      stripeError.name = 'StripeAPIError';
      mockStripe.customers.list.mockRejectedValue(stripeError);

      // Act & Assert
      await expect(
        customerService.findCustomerByEmail('test@example.com')
      ).rejects.toThrow(ExternalServiceError);

      expect(mockLogger.databaseOperation).toHaveBeenCalledWith(
        'stripe_find_customer_by_email_error',
        false,
        expect.objectContaining({
          error: 'Stripe API Error',
        })
      );
    });

    it('should validate email format', async () => {
      // Act & Assert
      await expect(
        customerService.findCustomerByEmail('invalid-email')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      // Arrange
      const customerData = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const mockCreatedCustomer = createMockStripeCustomer(customerData);
      mockStripe.customers.create.mockResolvedValue(mockCreatedCustomer);

      // Act
      const result = await customerService.createCustomer(customerData);

      // Assert
      expect(result).toEqual(mockCreatedCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: customerData.email,
        name: customerData.name,
        metadata: expect.objectContaining({
          source: 'tradersutopia',
          timestamp: expect.any(String),
        }),
      });
      expect(mockLogger.databaseOperation).toHaveBeenCalledWith(
        'stripe_create_customer_success',
        true,
        expect.objectContaining({
          email: 'tes***',
        })
      );
    });

    it('should handle validation errors', async () => {
      // Act & Assert
      await expect(
        customerService.createCustomer({
          email: 'invalid-email',
          name: 'Test User',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle Stripe card errors', async () => {
      // Arrange
      const cardError = new Error('Your card was declined');
      cardError.name = 'StripeCardError';
      mockStripe.customers.create.mockRejectedValue(cardError);

      // Act & Assert
      await expect(
        customerService.createCustomer({
          email: 'test@example.com',
          name: 'Test User',
        })
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('upsertCustomer', () => {
    it('should update existing customer', async () => {
      // Arrange
      const existingCustomer = createMockStripeCustomer({
        email: 'test@example.com',
        name: 'Old Name',
      });
      const updatedCustomer = createMockStripeCustomer({
        email: 'test@example.com',
        name: 'New Name',
      });

      mockStripe.customers.list.mockResolvedValue({
        data: [existingCustomer],
        has_more: false,
      });
      mockStripe.customers.update.mockResolvedValue(updatedCustomer);

      // Act
      const result = await customerService.upsertCustomer({
        email: 'test@example.com',
        name: 'New Name',
      });

      // Assert
      expect(result).toEqual(updatedCustomer);
      expect(mockStripe.customers.update).toHaveBeenCalledWith(
        existingCustomer.id,
        expect.objectContaining({
          name: 'New Name',
        })
      );
    });

    it('should create new customer when not found', async () => {
      // Arrange
      const newCustomer = createMockStripeCustomer({
        email: 'new@example.com',
        name: 'New User',
      });

      mockStripe.customers.list.mockResolvedValue({
        data: [],
        has_more: false,
      });
      mockStripe.customers.create.mockResolvedValue(newCustomer);

      // Act
      const result = await customerService.upsertCustomer({
        email: 'new@example.com',
        name: 'New User',
      });

      // Assert
      expect(result).toEqual(newCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
        })
      );
    });
  });

  describe('getCustomer', () => {
    it('should retrieve customer successfully', async () => {
      // Arrange
      const mockCustomer = createMockStripeCustomer();
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      // Act
      const result = await customerService.getCustomer('cus_123');

      // Assert
      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_123', {
        expand: ['customer', 'default_payment_method'],
      });
    });

    it('should throw error for deleted customer', async () => {
      // Arrange
      const deletedCustomer = { id: 'cus_123', deleted: true };
      mockStripe.customers.retrieve.mockResolvedValue(deletedCustomer);

      // Act & Assert
      await expect(customerService.getCustomer('cus_123')).rejects.toThrow(
        'Customer not found or deleted'
      );
    });

    it('should validate customer ID format', async () => {
      // Act & Assert
      await expect(customerService.getCustomer('invalid_id')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('searchCustomers', () => {
    it('should search customers successfully', async () => {
      // Arrange
      const mockResults = {
        data: [createMockStripeCustomer()],
        has_more: false,
        total_count: 1,
      };
      mockStripe.customers.search.mockResolvedValue(mockResults);

      // Act
      const result = await customerService.searchCustomers('test@example.com');

      // Assert
      expect(result).toEqual(mockResults);
      expect(mockStripe.customers.search).toHaveBeenCalledWith({
        query: 'email:"test@example.com"',
        limit: 10,
      });
    });
  });

  describe('getCustomerSubscriptionSummary', () => {
    it('should return subscription summary', async () => {
      // Arrange
      const mockCustomer = createMockStripeCustomer();
      const mockSubscriptions = {
        data: [
          {
            id: 'sub_123',
            status: 'active',
            latest_invoice: {
              created: Math.floor(Date.now() / 1000),
              amount_paid: 2999,
            },
          },
        ],
      };

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);
      mockStripe.subscriptions.list.mockResolvedValue(mockSubscriptions);

      // Act
      const result =
        await customerService.getCustomerSubscriptionSummary('cus_123');

      // Assert
      expect(result).toEqual({
        customer: mockCustomer,
        subscriptionCount: 1,
        activeSubscriptions: 1,
        lastPayment: expect.any(Date),
        totalPaid: 29.99,
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle rate limit errors', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'StripeRateLimitError';
      mockStripe.customers.list.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(
        customerService.findCustomerByEmail('test@example.com')
      ).rejects.toThrow(ExternalServiceError);

      expect(mockLogger.databaseOperation).toHaveBeenCalledWith(
        'stripe_find_customer_by_email_error',
        false,
        expect.objectContaining({
          type: 'StripeRateLimitError',
        })
      );
    });

    it('should mask sensitive data in logs', async () => {
      // Arrange
      const mockCustomer = createMockStripeCustomer({
        email: 'sensitive@example.com',
      });
      mockStripe.customers.list.mockResolvedValue({
        data: [mockCustomer],
        has_more: false,
      });

      // Act
      await customerService.findCustomerByEmail('sensitive@example.com');

      // Assert
      expect(mockLogger.databaseOperation).toHaveBeenCalledWith(
        'stripe_find_customer_by_email_success',
        true,
        expect.objectContaining({
          email: 'sen***', // Ensure email is masked
        })
      );
    });

    it('should handle empty customer list', async () => {
      // Arrange
      mockStripe.customers.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      // Act
      const result =
        await customerService.findCustomerByEmail('test@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('performance and optimization', () => {
    it('should use correct expand parameters for efficiency', async () => {
      // Arrange
      const mockCustomer = createMockStripeCustomer();
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      // Act
      await customerService.getCustomer('cus_123');

      // Assert
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(
        'cus_123',
        expect.objectContaining({
          expand: expect.arrayContaining([
            'customer',
            'default_payment_method',
          ]),
        })
      );
    });

    it('should limit search results appropriately', async () => {
      // Arrange
      mockStripe.customers.search.mockResolvedValue({
        data: [],
        has_more: false,
        total_count: 0,
      });

      // Act
      await customerService.searchCustomers('test', { limit: 5 });

      // Assert
      expect(mockStripe.customers.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5, // Should respect the limit
        })
      );
    });
  });
});
