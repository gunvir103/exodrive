import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/database.types';
import { DOCUSEAL_CONSTANTS } from '@/lib/constants/docuseal';
import {
  DocuSealSubmissionResponse,
  DocuSealDocument,
  ContractUpdateData,
  BookingEventInsert,
  extractSubmissionId
} from '@/lib/types/docuseal';

interface DocuSealSubmitter {
  name: string;
  email: string;
  role?: string;
  send_email?: boolean;
  send_sms?: boolean;
  phone?: string;
  fields?: Array<{
    name: string;
    value: string | number | boolean;
  }>;
}

interface DocuSealSubmissionPayload {
  template_id: number;
  send_email?: boolean;
  send_sms?: boolean;
  submitters: DocuSealSubmitter[];
  metadata?: {
    booking_id?: string;
    booking_reference?: string;
    customer_id?: string;
    car_id?: string;
    rental_dates?: string;
    rental_days?: number;
    total_amount?: number;
    currency?: string;
    [key: string]: string | number | boolean | undefined;
  };
  message?: {
    subject?: string;
    body?: string;
  };
}

// DocuSealSubmissionResponse interface moved to lib/types/docuseal.ts for reusability

export class DocuSealService {
  private apiUrl: string;
  private apiToken: string;
  private templateId: number;
  private supabase: ReturnType<typeof createClient<Database>>;

  // Accept only E.164 (+<country><digits>) or try to normalize simple US-style inputs
  private toE164IfValid(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const trimmed = String(raw).trim();
    // Already valid E.164
    if (DOCUSEAL_CONSTANTS.PHONE_REGEX.E164.test(trimmed)) return trimmed;
    // Try to normalize: remove non-digits
    const digits = trimmed.replace(/\D/g, '');
    if (DOCUSEAL_CONSTANTS.PHONE_REGEX.US_10_DIGIT.test(digits)) return `+1${digits}`; // assume US if 10 digits
    if (digits.length >= 7 && digits.length <= 15) return `+${digits}`; // best-effort
    return undefined;
  }

  constructor(
    apiUrl: string = process.env.DOCUSEAL_API_URL!,
    apiToken: string = process.env.DOCUSEAL_API_TOKEN!,
    templateId: string = process.env.DOCUSEAL_TEMPLATE_ID!,
    supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY!,
    supabaseClient?: ReturnType<typeof createClient<Database>>
  ) {
    if (!apiUrl || !apiToken || !templateId) {
      throw new Error('DocuSeal configuration missing');
    }

    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
    this.templateId = parseInt(templateId);
    // Use provided client or create new one - avoid unsafe any cast
    this.supabase = supabaseClient || createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Generate and send a rental contract for a booking
   */
  async generateContract(bookingId: string): Promise<{
    success: boolean;
    submissionId?: string;
    error?: string;
  }> {
    try {
      // Define the type for our booking query result
      type BookingWithRelations = {
        id: string;
        start_date: string;
        end_date: string;
        total_price: number;
        currency: string;
        customer_id: string;
        car_id: string;
        contract_submission_id?: string;
        customers: {
          first_name: string | null;
          last_name: string | null;
          email: string;
          phone: string | null;
        };
        cars: {
          name: string;
        };
      };

      // Fetch booking details with customer and car information (only needed fields)
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          total_price,
          currency,
          customer_id,
          car_id,
          contract_submission_id,
          customers (first_name, last_name, email, phone),
          cars (name)
        `)
        .eq('id', bookingId)
        .single<BookingWithRelations>();

      if (bookingError) {
        console.error('Error fetching booking:', bookingError);
        return {
          success: false,
          error: `Booking not found: ${bookingError.message}`
        };
      }

      if (!booking) {
        return {
          success: false,
          error: 'Booking not found'
        };
      }

      // Check if contract already exists (safely handle missing column)
      const hasExistingContract = 'contract_submission_id' in booking && booking.contract_submission_id;
      if (hasExistingContract) {
        return {
          success: false,
          error: 'Contract already generated for this booking',
          submissionId: booking.contract_submission_id
        };
      }

      // Format dates
      const startDate = new Date(booking.start_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const endDate = new Date(booking.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Calculate rental duration
      const start = new Date(booking.start_date);
      const end = new Date(booking.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Format customer name
      const customerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Customer';

      // Fetch car specifications (Make, Model, Year, Color) for this car
      const { data: specs, error: specsError } = await this.supabase
        .from('car_specifications')
        .select('name, value')
        .eq('car_id', booking.car_id);

      if (specsError) {
        console.warn('Unable to load car specifications for DocuSeal fields:', specsError);
      }

      const specMap = (specs || []).reduce<Record<string, string>>((acc, s) => {
        const key = (s.name || '').trim().toLowerCase();
        acc[key] = s.value || '';
        return acc;
      }, {});

      const vehicleMake = specMap['make'] || 'N/A';
      const vehicleModel = specMap['model'] || 'N/A';
      const vehicleYear = specMap['year'] || '0000';
      const vehicleColor = specMap['color'] || 'N/A';

      // Load per-day base price to compute Base Fee (days * base_price)
      let perDayBasePrice = 0;
      try {
        const { data: pricing } = await this.supabase
          .from('car_pricing')
          .select('base_price')
          .eq('car_id', booking.car_id)
          .single();
        perDayBasePrice = pricing?.base_price ?? 0;
      } catch (e) {
        // If pricing not found, fall back to 0; can refine later
        perDayBasePrice = 0;
      }

      const baseFeeTotal = perDayBasePrice * days;

      // Prepare submission fields matching template names exactly
      // Customer will fill remaining PII directly in DocuSeal
      const primaryRenterFields = [
        { name: 'vehicle_make', value: vehicleMake },
        { name: 'vehicle_model', value: vehicleModel },
        { name: 'vehicle_year', value: vehicleYear },
        { name: 'vehicle_color', value: vehicleColor },

        { name: 'estimated start date', value: startDate },
        { name: 'estimated end date', value: endDate },

        { name: 'Base Fee', value: `$${baseFeeTotal.toFixed(2)}` },
        { name: 'Miles', value: 'N/A' },

        { name: 'Primary Vehicle Operator', value: customerName },
        { name: 'Phone Number', value: booking.customers?.phone || 'N/A' },

        { name: 'Return Address', value: 'As agreed upon pickup' }
      ];

      // Create submission payload
      const e164Phone = this.toE164IfValid(booking.customers?.phone);

      const payload: DocuSealSubmissionPayload = {
        template_id: this.templateId,
        send_email: true,
        submitters: [
          {
            name: 'Exodrive Exotics',
            email: process.env.COMPANY_EMAIL || 'contracts@exodriveexotics.com',
            role: 'Exodrive Exotics', // must match template submitter role
            fields: primaryRenterFields
          },
          {
            name: customerName,
            email: booking.customers?.email,
            // Only include phone if valid E.164 to avoid DocuSeal 422 errors
            phone: e164Phone,
            role: 'Renter', // must match template submitter role
            send_email: true,
            fields: []  // Additional driver fields if needed
          }
        ],
        metadata: {
          booking_id: bookingId,
          booking_reference: booking.id,
          customer_id: booking.customer_id,
          car_id: booking.car_id,
          rental_dates: `${startDate} - ${endDate}`,
          rental_days: days,
          total_amount: booking.total_price,
          currency: booking.currency
        },
        message: {
          subject: `Rental Agreement - ${booking.id}`,
          body: `Dear ${customerName},\n\nPlease review and sign your rental agreement for your upcoming ${booking.cars?.name || 'vehicle'} rental from ${startDate} to ${endDate}.\n\nBooking Reference: ${booking.id}\n\nIMPORTANT: You will need to provide the following information in the contract:\n• Driver's License Number\n• Current Address\n• Insurance Company and Policy Number\n\nThese details will be verified by our team before your rental.\n\nPlease sign the agreement at your earliest convenience to confirm your reservation.\n\nBest regards,\nExoDrive Exotics Team`
        }
      };

      // Send to DocuSeal API
      const response = await fetch(`${this.apiUrl}/submissions`, {
        method: 'POST',
        headers: {
          'X-Auth-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DocuSeal API error:', errorText);
        return {
          success: false,
          error: `DocuSeal API error: ${response.status} - ${errorText}`
        };
      }

      const submissionRaw = await response.json();
      const submissionId = extractSubmissionId(submissionRaw);
      const submissionSlug = typeof submissionRaw === 'object' && 'slug' in submissionRaw ? 
        String(submissionRaw.slug) : undefined;

      if (!submissionId) {
        console.error('DocuSeal create submission: unexpected response shape', submissionRaw);
        return {
          success: false,
          error: 'DocuSeal API error: missing submission id in response'
        };
      }

      // Update booking with submission ID
      const contractUpdateData: Partial<ContractUpdateData> = {
        contract_submission_id: String(submissionId),
        contract_status: 'sent',
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await this.supabase
        .from('bookings')
        .update(contractUpdateData)
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking with submission ID:', updateError);
      }

      // Log event
      const eventData: BookingEventInsert = {
        booking_id: bookingId,
        event_type: 'contract_sent',
        actor_type: 'system',
        actor_id: 'docuseal-service',
        summary_text: `Contract sent to ${booking.customers?.email || 'customer'}`,
        details: {
          submission_id: submissionId,
          submission_slug: submissionSlug,
          template_id: this.templateId
        }
      };
      await this.supabase.from('booking_events').insert(eventData);

      return {
        success: true,
        submissionId: String(submissionId)
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate contract';
      console.error('Error generating contract:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Resend contract to customer
   */
  async resendContract(bookingId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get booking with submission ID and customer data
      type BookingWithCustomer = {
        contract_submission_id: string;
        customers: {
          email: string;
          first_name: string | null;
          last_name: string | null;
        } | null;
      };

      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select('contract_submission_id, customers (email, first_name, last_name)')
        .eq('id', bookingId)
        .single<BookingWithCustomer>();

      if (bookingError || !booking || !booking.contract_submission_id) {
        return {
          success: false,
          error: 'Booking or submission not found'
        };
      }

      // Resend via DocuSeal API
      const response = await fetch(
        `${this.apiUrl}/submissions/${booking.contract_submission_id}/remind`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Token': this.apiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Reminder: Please complete your rental agreement'
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to resend: ${errorText}`
        };
      }

      // Log event
      const reminderEvent: BookingEventInsert = {
        booking_id: bookingId,
        event_type: 'system_reminder_sent',
        actor_type: 'system',
        actor_id: 'docuseal-service',
        summary_text: `Contract reminder sent to ${booking.customers?.email || 'customer'}`,
        details: {
          submission_id: booking.contract_submission_id
        }
      };
      await this.supabase.from('booking_events').insert(reminderEvent);

      return { success: true };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend contract';
      console.error('Error resending contract:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get submission status from DocuSeal
   */
  async getSubmissionStatus(submissionId: string): Promise<{
    success: boolean;
    status?: string;
    data?: DocuSealSubmissionResponse;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/submissions/${submissionId}`,
        {
          headers: {
            'X-Auth-Token': this.apiToken
          }
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch submission: ${response.status}`
        };
      }

      const submission = await response.json() as DocuSealSubmissionResponse;
      
      // Determine overall status from submitters
      const statuses = submission.submitters.map(s => s.status);
      let overallStatus = 'pending';
      
      if (statuses.every((s: string) => s === 'completed')) {
        overallStatus = 'completed';
      } else if (statuses.some((s: string) => s === 'declined')) {
        overallStatus = 'declined';
      } else if (statuses.some((s: string) => s === 'opened')) {
        overallStatus = 'opened';
      } else if (statuses.some((s: string) => s === 'sent')) {
        overallStatus = 'sent';
      }

      return {
        success: true,
        status: overallStatus,
        data: submission
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status';
      console.error('Error fetching submission status:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Download signed contract document
   */
  async downloadSignedContract(submissionId: string): Promise<{
    success: boolean;
    documents?: Array<{ url: string; filename: string }>;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/submissions/${submissionId}/documents`,
        {
          headers: {
            'X-Auth-Token': this.apiToken
          }
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch documents: ${response.status}`
        };
      }

      const documents = await response.json();

      return {
        success: true,
        documents: documents.map((doc: DocuSealDocument) => ({
          url: doc.url,
          filename: doc.filename || 'rental-agreement.pdf'
        }))
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download documents';
      console.error('Error downloading documents:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Archive a submission
   */
  async archiveSubmission(submissionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/submissions/${submissionId}/archive`,
        {
          method: 'PUT',
          headers: {
            'X-Auth-Token': this.apiToken
          }
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to archive submission: ${response.status}`
        };
      }

      return { success: true };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive submission';
      console.error('Error archiving submission:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

}

// Singleton instance
let docusealService: DocuSealService | null = null;

export function getDocuSealService(): DocuSealService {
  if (!docusealService) {
    docusealService = new DocuSealService();
  }
  return docusealService;
}
