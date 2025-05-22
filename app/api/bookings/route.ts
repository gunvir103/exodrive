import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'; // Corrected path
import { z } from 'zod'; // Import Zod
import { differenceInCalendarDays, format } from 'date-fns'; // For calculating date differences
import { v4 as uuidv4 } from 'uuid'; // For generating booking ID
import { emailServiceResend, type BookingConfirmationData } from '@/lib/services/email-service-resend';
import { Resend } from 'resend'; // Resend is used internally by emailServiceResend, but we might need its types or for direct use if planned.
// Potentially import types for request body, car, booking, customer, etc.
// import { Resend } from 'resend'; // For sending emails

// const resend = new Resend(process.env.RESEND_API_KEY);

// Define Zod schema for input validation
const bookingRequestSchema = z.object({
  car_id: z.string().uuid({ message: "Invalid car ID format." }),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Start date must be in YYYY-MM-DD format." }),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "End date must be in YYYY-MM-DD format." }),
  first_name: z.string().min(1, { message: "First name is required." }),
  last_name: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(), // Phone is optional for now
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --- 1. Input Validation ---
    const validationResult = bookingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid input", 
          details: validationResult.error.flatten().fieldErrors 
        }, 
        { status: 400 }
      );
    }

    const {
      car_id,
      start_date,
      end_date,
      first_name,
      last_name,
      email,
      phone,
    } = validationResult.data; // Use validated data

    // Further date logic validation (e.g., start_date before end_date)
    if (new Date(start_date) >= new Date(end_date)) {
      return NextResponse.json({ error: "Start date must be before end date." }, { status: 400 });
    }
    // Potentially check if start_date is not in the past etc.

    const supabaseAdmin = createSupabaseServiceRoleClient(); // Initialize admin client

    // --- 2. Upsert Customer Record ---
    let customerId: string;

    const { data: existingCustomer, error: fetchCustomerError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 record gracefully

    if (fetchCustomerError) {
      console.error('Error fetching customer:', fetchCustomerError);
      return NextResponse.json({ error: 'Failed to process customer information.' }, { status: 500 });
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Optionally update existing customer details if they differ
      const { error: updateCustomerError } = await supabaseAdmin
        .from('customers')
        .update({
          first_name: first_name,
          last_name: last_name,
          phone: phone, // Will set to null if phone is undefined, which is fine
          // user_id should remain as it is (likely NULL or a previously linked user_id)
        })
        .eq('id', customerId);

      if (updateCustomerError) {
        console.error('Error updating customer:', updateCustomerError);
        // Non-critical, proceed with booking but log the error
      }
    } else {
      // Create new customer
      const { data: newCustomer, error: createCustomerError } = await supabaseAdmin
        .from('customers')
        .insert({
          email: email,
          first_name: first_name,
          last_name: last_name,
          phone: phone,
          user_id: null, // Explicitly set user_id to NULL for guest customers
        })
        .select('id')
        .single(); // Expect a single record to be created and returned

      if (createCustomerError || !newCustomer) {
        console.error('Error creating customer:', createCustomerError);
        return NextResponse.json({ error: 'Failed to create customer record.' }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // --- 3. Calculate Total Price ---
    const { data: carData, error: carError } = await supabaseAdmin
      .from('cars')
      .select('id, name, car_pricing ( base_price )' ) // Corrected: use car_pricing table
      .eq('id', car_id)
      .single();

    if (carError || !carData) {
      console.error('Error fetching car details for price calculation:', carError);
      return NextResponse.json({ error: 'Failed to fetch car details for booking.' }, { status: 500 });
    }

    // Accessing related data from Supabase: 
    // If it's a one-to-one relationship (car_pricing.car_id is unique),
    // Supabase might return car_pricing as an object directly, not an array.
    // If it's treated as one-to-many (even if data implies one-to-one), it's an array.
    // The .single() on the parent query might influence this for joined data.
    // Let's be safe and check for both object and array, prioritizing direct object access if not an array.

    const carPricingData = carData.car_pricing;

    let base_price: number | undefined;

    if (Array.isArray(carPricingData)) {
        // If it's an array, expect an array of objects with base_price
        if (carPricingData.length > 0 && typeof carPricingData[0]?.base_price === 'number') {
            base_price = carPricingData[0].base_price;
        }
    } else if (typeof carPricingData === 'object' && carPricingData !== null && 'base_price' in carPricingData && typeof (carPricingData as any).base_price === 'number') {
        // If it's a single object, directly access base_price
        base_price = (carPricingData as any).base_price;
    }

    if (base_price === undefined) {
        console.error('Invalid or missing pricing information for car:', car_id, carData.car_pricing); 
        return NextResponse.json({ error: 'Car pricing information is unavailable or invalid.' }, { status: 400 });
    }

    const pricePerDay = base_price;
    const bookingStartDate = new Date(start_date);
    const bookingEndDate = new Date(end_date);
    
    // Ensure end_date is inclusive for day calculation if your model implies that.
    // differenceInCalendarDays is exclusive of the end date by default for full day counts.
    // For rental periods, often it's inclusive: e.g., booking for 1 day (Jan 1 to Jan 1) is 1 day.
    // Booking from Jan 1 to Jan 2 is 2 days.
    const numberOfDays = differenceInCalendarDays(bookingEndDate, bookingStartDate) + 1;

    if (numberOfDays <= 0) {
        return NextResponse.json({ error: 'Booking duration must be at least one day.' }, { status: 400 });
    }

    const total_price = pricePerDay * numberOfDays;

    // --- 4. Atomic Car Availability Check & Hold ---
    const newBookingId = uuidv4(); // Generate a UUID for the new booking

    const { data: availabilityReserved, error: availabilityError } = await supabaseAdmin.rpc(
      'check_and_reserve_car_availability',
      {
        p_car_id: car_id,
        p_start_date: start_date,
        p_end_date: end_date,
        p_booking_id: newBookingId,
      }
    );

    if (availabilityError) {
      console.error('Error calling check_and_reserve_car_availability RPC:', availabilityError);
      return NextResponse.json({ error: 'Failed to check car availability. Please try again.' }, { status: 500 });
    }

    if (availabilityReserved === false) { // Explicitly check for false
      return NextResponse.json({ error: 'Sorry, the selected dates are no longer available for this car. Please choose different dates.' }, { status: 409 }); // 409 Conflict
    }
    
    // If availabilityReserved is true, proceed to create the booking record

    // --- 5. Insert into Bookings Table ---
    const { data: newBooking, error: insertBookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        id: newBookingId, // Use the pre-generated UUID
        customer_id: customerId,
        car_id: car_id,
        start_date: start_date,
        end_date: end_date,
        total_price: total_price,
        currency: 'USD', // Default currency, adjust if needed
        status: 'pending', // Initial status
        payment_status: 'pending_invoice', // Initial payment status
        notes: body.notes || null, // Include notes if provided in the request body
      })
      .select('id') // Select the id to confirm insertion
      .single();

    console.log('DEBUG: After booking insert attempt:');
    console.log('DEBUG: newBooking:', JSON.stringify(newBooking, null, 2));
    console.log('DEBUG: insertBookingError:', JSON.stringify(insertBookingError, null, 2));

    if (insertBookingError || !newBooking) {
      console.error('Error inserting booking record:', insertBookingError);
      // CRITICAL: If booking insertion fails, attempt to roll back the availability reservation.
      console.log(`Attempting to roll back availability for tentative booking ID: ${newBookingId}`);
      const { error: rollbackError } = await supabaseAdmin.rpc('clear_car_availability_hold', {
        p_booking_id: newBookingId,
      });
      if (rollbackError) {
        console.error(`CRITICAL FAILURE: Failed to roll back car availability for ${newBookingId}:`, rollbackError);
        // This situation might require manual intervention or more sophisticated alerting.
      } else {
        console.log(`Successfully rolled back availability for tentative booking ID: ${newBookingId}`);
      }
      return NextResponse.json({ error: 'Failed to create your booking. Please try again.' }, { status: 500 });
    }

    const booking_id = newBooking.id;
    console.log(`DEBUG: Successfully got booking_id: ${booking_id}`);

    // --- 6. Send "Booking Request Received" Email ---
    const customerEmailData: BookingConfirmationData = {
      bookingId: booking_id,
      customerName: `${first_name} ${last_name}`,
      customerEmail: email,
      customerPhone: phone || undefined,
      carName: carData.name || 'Requested Vehicle', // Use fetched car name
      startDate: format(bookingStartDate, "MMMM d, yyyy"), // Format dates for email
      endDate: format(bookingEndDate, "MMMM d, yyyy"),
      days: numberOfDays,
      basePrice: pricePerDay,
      totalPrice: total_price,
      deposit: Math.round(total_price * 0.3), // Assuming 30% deposit, adjust as per your business logic
    };

    const emailHtmlContent = emailServiceResend.generateBookingConfirmationHtml(customerEmailData);
    const emailPlainTextContent = emailServiceResend.generateBookingConfirmationPlainText(customerEmailData);

    // Attempt to send email and log it regardless of success/failure to send
    // The actual Resend email ID might only be available on successful send from Resend's API directly.
    // For now, we'll log what we can. The emailServiceResend.sendEmail returns a simple success/error.
    // To get the actual Resend email ID, you might need to modify emailServiceResend or call Resend directly here if it returns it.
    
    // For logging, we use a placeholder for resend_email_id if sendEmail doesn't return it.
    // Ideally, your emailService.sendEmail would return { success: boolean, error?: string, messageId?: string }
    let resendMessageId: string | null = null;

    try {
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const sendResult = await emailServiceResend.sendEmail({
            to: email,
            subject: `Your ExoDrive Booking Request Received - #${booking_id.substring(0,8)}`,
            content: emailHtmlContent,
            plainText: emailPlainTextContent,
            tags: [{ name: 'booking_request', value: 'true' }, { name: 'booking_id', value: booking_id }]
        }, ipAddress.split(',')[0]);

        if (sendResult.success) {
            console.log(`Booking request email sent to ${email} for booking ${booking_id}`);
            // If sendResult contained a messageId from Resend, assign it here:
            resendMessageId = sendResult.messageId || null; 
        } else {
            console.error(`Failed to send booking request email to ${email} for booking ${booking_id}:`, sendResult.error);
            // Even if email fails, the booking is made. Log this issue.
        }
    } catch (emailError) {
        console.error(`Error during email sending process for booking ${booking_id}:`, emailError);
    }
    
    // Log to inbox_emails table
    console.log(`DEBUG: Attempting to log to inbox_emails for booking_id: ${booking_id}`);
    const { data: loggedEmailData, error: logEmailError } = await supabaseAdmin // Corrected variable name
      .from('inbox_emails')
      .insert({
        // resend_email_id should ideally come from the Resend API response upon successful sending.
        // Using a placeholder or booking_id if not directly available.
        resend_email_id: resendMessageId || `email_not_sent_${booking_id}`,
        recipient_email: email,
        sender_email: 'ExoDrive <BookingSolutions@exodrive.co>', // Default sender from your service
        subject: `Your ExoDrive Booking Request Received - #${booking_id.substring(0,8)}`,
        booking_id: booking_id,
        last_event_type: 'internal_log_on_creation', // Custom status
        tags: [{ name: 'booking_request', value: 'true' }, { name: 'booking_id', value: booking_id }],
        // raw_payload could store the emailHtmlContent if needed, or parts of customerEmailData
      })
      .select(); // Added .select() to get returned data

    console.log('DEBUG: After inbox_emails insert attempt:');
    console.log('DEBUG: loggedEmailData:', JSON.stringify(loggedEmailData, null, 2));
    console.log('DEBUG: logEmailError:', JSON.stringify(logEmailError, null, 2));

    if (logEmailError) {
        console.error(`Failed to log email for booking ${booking_id} to inbox_emails:`, logEmailError);
        // This is a non-critical error for the booking flow itself.
    }

    // --- 7. (Optional) Notify Admin ---
    // TODO: Implement admin notification if desired


    // --- 8. Return Booking ID and Success ---
    return NextResponse.json({ 
      message: 'Booking request received successfully. We will contact you for payment & contract.',
      booking_id: booking_id // Use the actual booking_id from the inserted record
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    if (error instanceof z.ZodError) { // Handle Zod errors specifically if needed, though safeParse catches it
        errorMessage = 'Invalid input data.';
        return NextResponse.json({ error: errorMessage, details: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 