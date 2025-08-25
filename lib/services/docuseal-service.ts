import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

interface DocuSealSubmitter {
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  fields?: Array<{
    name: string;
    value: string | number | boolean;
  }>;
  metadata?: Record<string, any>;
}

interface DocuSealSubmission {
  template_id: number | string;
  send_email?: boolean;
  send_sms?: boolean;
  order?: 'preserved' | 'random';
  expire_at?: string;
  message?: {
    subject?: string;
    body?: string;
  };
  submitters: DocuSealSubmitter[];
}

export class DocuSealService {
  private apiKey: string;
  private apiBaseUrl: string;

  constructor() {
    this.apiKey = process.env.DOCUSEAL_API_KEY || '';
    this.apiBaseUrl = process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com';
    
    if (!this.apiKey) {
      console.warn('DocuSeal API key is not configured');
    }
  }

  /**
   * Create a new document submission with pre-filled data
   */
  async createSubmission(submission: DocuSealSubmission): Promise<any> {
    if (!this.apiKey) {
      throw new Error('DocuSeal API key is not configured');
    }

    const response = await fetch(`${this.apiBaseUrl}/submissions`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocuSeal API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a rental agreement document for a booking
   */
  async createRentalAgreement(bookingId: string): Promise<any> {
    const supabase = createSupabaseServiceRoleClient();

    // Fetch booking details with all related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers!inner(*),
        car:cars!inner(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    // Fetch car specifications
    const { data: specifications } = await supabase
      .from('car_specifications')
      .select('name, value')
      .eq('car_id', booking.car_id);

    // Extract car details from specifications or use defaults
    const carSpecs = this.extractCarSpecifications(specifications || [], booking.car);

    // Format dates
    const pickupDate = new Date(booking.start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const dropoffDate = new Date(booking.end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Calculate rental days
    const rentalDays = Math.ceil(
      (new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 
      (1000 * 60 * 60 * 24)
    );

    // Prepare the document fields
    const documentFields = [
      // Customer Information
      { name: 'customer_full_name', value: `${booking.customer.first_name} ${booking.customer.last_name}` },
      { name: 'customer_first_name', value: booking.customer.first_name },
      { name: 'customer_last_name', value: booking.customer.last_name },
      { name: 'customer_email', value: booking.customer.email },
      { name: 'customer_phone', value: booking.customer.phone || '' },
      
      // Vehicle Information
      { name: 'vehicle_make', value: carSpecs.make },
      { name: 'vehicle_model', value: carSpecs.model },
      { name: 'vehicle_year', value: carSpecs.year },
      { name: 'vehicle_name', value: booking.car.name },
      { name: 'vehicle_description', value: booking.car.description },
      
      // Rental Details
      { name: 'pickup_date', value: pickupDate },
      { name: 'dropoff_date', value: dropoffDate },
      { name: 'rental_days', value: rentalDays },
      { name: 'rental_amount', value: booking.total_price },
      { name: 'security_deposit', value: booking.security_deposit_amount || 0 },
      { name: 'currency', value: booking.currency },
      
      // Booking Reference
      { name: 'booking_id', value: bookingId },
      { name: 'booking_reference', value: bookingId.slice(0, 8).toUpperCase() },
      { name: 'booking_date', value: new Date(booking.created_at).toLocaleDateString('en-US') },
    ];

    // Get the template ID from environment or use default
    const templateId = process.env.DOCUSEAL_RENTAL_TEMPLATE_ID || '';
    
    if (!templateId) {
      throw new Error('DocuSeal rental template ID is not configured');
    }

    // Create the submission
    const submission: DocuSealSubmission = {
      template_id: templateId,
      send_email: true,
      send_sms: !!booking.customer.phone,
      message: {
        subject: `Your ExoDrive Rental Agreement - ${carSpecs.make} ${carSpecs.model}`,
        body: `Dear ${booking.customer.first_name},\n\nPlease review and sign your rental agreement for the ${carSpecs.make} ${carSpecs.model} from ${pickupDate} to ${dropoffDate}.\n\nThank you for choosing ExoDrive!`,
      },
      submitters: [
        {
          email: booking.customer.email,
          name: `${booking.customer.first_name} ${booking.customer.last_name}`,
          phone: booking.customer.phone || undefined,
          role: 'Renter',
          fields: documentFields,
          metadata: {
            booking_id: bookingId,
            customer_id: booking.customer_id,
          },
        },
      ],
    };

    try {
      const docusealResponse = await this.createSubmission(submission);

      // Update booking with DocuSeal submission details
      await supabase
        .from('bookings')
        .update({
          contract_submission_id: docusealResponse.id?.toString(),
          contract_signing_url: docusealResponse.submitters?.[0]?.embed_url || docusealResponse.submitters?.[0]?.url,
          contract_status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      // Log the event
      await supabase.from('booking_events').insert({
        booking_id: bookingId,
        event_type: 'contract_sent',
        actor_type: 'system',
        actor_id: 'payment-capture',
        summary_text: 'Rental agreement sent to customer for signature',
        details: {
          docuseal_submission_id: docusealResponse.id,
          template_id: templateId,
          customer_email: booking.customer.email,
        },
      });

      return docusealResponse;
    } catch (error) {
      // Log the error
      await supabase.from('booking_events').insert({
        booking_id: bookingId,
        event_type: 'contract_error',
        actor_type: 'system',
        actor_id: 'payment-capture',
        summary_text: 'Failed to create rental agreement',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Extract car specifications from the specifications table
   * This works with the existing database structure without requiring schema changes
   */
  private extractCarSpecifications(
    specifications: Array<{ name: string; value: string }>,
    car: any
  ): { make: string; model: string; year: string } {
    const specs: { make: string; model: string; year: string } = {
      make: '',
      model: '',
      year: '',
    };

    // Look for make, model, year in the car_specifications table
    // The specifications are stored as name-value pairs
    specifications.forEach((spec) => {
      const name = spec.name.toLowerCase().trim();
      const value = spec.value.trim();
      
      // Check for various naming conventions that might be used
      if (name === 'make' || name === 'manufacturer' || name === 'brand') {
        specs.make = value;
      } else if (name === 'model' || name === 'model name') {
        specs.model = value;
      } else if (name === 'year' || name === 'model year' || name === 'year of manufacture') {
        specs.year = value;
      }
    });

    // If not found in specifications, try to intelligently parse from car name
    // Common formats: "2024 Toyota Camry", "Toyota Camry 2024", "BMW X5", etc.
    if (!specs.make || !specs.model || !specs.year) {
      const nameParts = car.name.split(/\s+/).filter(part => part.length > 0);
      
      // Pattern 1: Year at the beginning (e.g., "2024 Toyota Camry")
      if (nameParts[0] && /^\d{4}$/.test(nameParts[0])) {
        specs.year = specs.year || nameParts[0];
        if (nameParts[1]) specs.make = specs.make || nameParts[1];
        if (nameParts[2]) specs.model = specs.model || nameParts.slice(2).join(' ');
      } 
      // Pattern 2: Year at the end (e.g., "Toyota Camry 2024")
      else if (nameParts.length > 0 && /^\d{4}$/.test(nameParts[nameParts.length - 1])) {
        specs.year = specs.year || nameParts[nameParts.length - 1];
        if (nameParts[0]) specs.make = specs.make || nameParts[0];
        if (nameParts.length > 2) {
          specs.model = specs.model || nameParts.slice(1, -1).join(' ');
        } else if (nameParts[1]) {
          specs.model = specs.model || nameParts[1];
        }
      }
      // Pattern 3: No year in name (e.g., "Toyota Camry" or "BMW X5")
      else if (nameParts.length >= 2) {
        specs.make = specs.make || nameParts[0];
        specs.model = specs.model || nameParts.slice(1).join(' ');
        // Use current year as default if no year found
        specs.year = specs.year || new Date().getFullYear().toString();
      }
      // Pattern 4: Single word name - use it as model
      else if (nameParts.length === 1) {
        specs.model = specs.model || nameParts[0];
      }
    }

    // Provide sensible defaults if still not found
    return {
      make: specs.make || 'Standard',
      model: specs.model || car.name || 'Vehicle',
      year: specs.year || new Date().getFullYear().toString(),
    };
  }

  /**
   * Get the status of a submission
   */
  async getSubmissionStatus(submissionId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('DocuSeal API key is not configured');
    }

    const response = await fetch(`${this.apiBaseUrl}/submissions/${submissionId}`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocuSeal API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Download signed document
   */
  async downloadDocument(submissionId: string): Promise<Blob> {
    if (!this.apiKey) {
      throw new Error('DocuSeal API key is not configured');
    }

    const response = await fetch(`${this.apiBaseUrl}/submissions/${submissionId}/documents`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocuSeal API error: ${response.status} - ${error}`);
    }

    return response.blob();
  }
}

// Export a singleton instance
export const docuSealService = new DocuSealService();
