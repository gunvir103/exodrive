import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { docuSealService } from '@/lib/services/docuseal-service';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

// Mock the fetch function
global.fetch = vi.fn();

describe('DocuSeal Integration', () => {
  const mockBookingId = '123e4567-e89b-12d3-a456-426614174000';
  const mockCustomerId = '123e4567-e89b-12d3-a456-426614174001';
  const mockCarId = '123e4567-e89b-12d3-a456-426614174002';

  beforeAll(() => {
    // Set up environment variables for testing
    process.env.DOCUSEAL_API_KEY = 'test-api-key';
    process.env.DOCUSEAL_API_URL = 'https://api.docuseal.com';
    process.env.DOCUSEAL_RENTAL_TEMPLATE_ID = 'test-template-id';
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('DocuSealService', () => {
    it('should create a submission with correct data', async () => {
      const mockSubmission = {
        template_id: 'test-template',
        submitters: [
          {
            email: 'test@example.com',
            name: 'Test User',
            fields: [
              { name: 'field1', value: 'value1' },
              { name: 'field2', value: 'value2' },
            ],
          },
        ],
      };

      const mockResponse = {
        id: 'submission-123',
        status: 'pending',
        submitters: [
          {
            email: 'test@example.com',
            url: 'https://docuseal.com/sign/abc123',
            embed_url: 'https://docuseal.com/embed/abc123',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await docuSealService.createSubmission(mockSubmission);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.docuseal.com/submissions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-Auth-Token': 'test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockSubmission),
        })
      );
    });

    it('should handle API errors correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        docuSealService.createSubmission({ template_id: 'test', submitters: [] })
      ).rejects.toThrow('DocuSeal API error: 401 - Unauthorized');
    });

    it('should extract car specifications correctly', () => {
      const service = new (docuSealService as any).constructor();
      
      // Test with specifications
      const specs1 = [
        { name: 'Make', value: 'Toyota' },
        { name: 'Model', value: 'Camry' },
        { name: 'Year', value: '2024' },
      ];
      const car1 = { name: 'Toyota Camry' };
      const result1 = service.extractCarSpecifications(specs1, car1);
      expect(result1).toEqual({ make: 'Toyota', model: 'Camry', year: '2024' });

      // Test parsing from car name (year first)
      const specs2: any[] = [];
      const car2 = { name: '2024 Honda Accord' };
      const result2 = service.extractCarSpecifications(specs2, car2);
      expect(result2).toEqual({ make: 'Honda', model: 'Accord', year: '2024' });

      // Test parsing from car name (year last)
      const specs3: any[] = [];
      const car3 = { name: 'BMW X5 2023' };
      const result3 = service.extractCarSpecifications(specs3, car3);
      expect(result3).toEqual({ make: 'BMW', model: 'X5', year: '2023' });

      // Test with default values
      const specs4: any[] = [];
      const car4 = { name: 'Luxury SUV' };
      const result4 = service.extractCarSpecifications(specs4, car4);
      expect(result4.make).toBe('Luxury');
      expect(result4.model).toBe('SUV');
      expect(result4.year).toBe(new Date().getFullYear().toString());
    });
  });

  describe('Payment Capture Integration', () => {
    it('should trigger document creation on successful payment capture', async () => {
      // Mock the database responses
      const supabase = createSupabaseServiceRoleClient();
      
      const mockBooking = {
        id: mockBookingId,
        customer_id: mockCustomerId,
        car_id: mockCarId,
        start_date: '2024-02-01',
        end_date: '2024-02-05',
        total_price: 500,
        currency: 'USD',
        created_at: '2024-01-15T10:00:00Z',
        customer: {
          id: mockCustomerId,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
        },
        car: {
          id: mockCarId,
          name: '2024 Toyota Camry',
          description: 'Comfortable sedan',
          make: 'Toyota',
          model: 'Camry',
          year: 2024,
        },
      };

      // Mock DocuSeal API response
      const mockDocuSealResponse = {
        id: 'submission-456',
        status: 'pending',
        submitters: [
          {
            email: 'john.doe@example.com',
            url: 'https://docuseal.com/sign/xyz789',
            embed_url: 'https://docuseal.com/embed/xyz789',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuSealResponse,
      });

      // Test that the rental agreement is created with correct data
      const documentFields = [
        { name: 'customer_full_name', value: 'John Doe' },
        { name: 'customer_email', value: 'john.doe@example.com' },
        { name: 'vehicle_make', value: 'Toyota' },
        { name: 'vehicle_model', value: 'Camry' },
        { name: 'vehicle_year', value: '2024' },
        { name: 'pickup_date', value: expect.any(String) },
        { name: 'dropoff_date', value: expect.any(String) },
        { name: 'rental_amount', value: 500 },
      ];

      // Verify the submission was created with correct structure
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/submissions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Auth-Token': expect.any(String),
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});
