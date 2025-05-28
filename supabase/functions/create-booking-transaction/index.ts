import { serve } from "jsr:@std/http";
import { createClient } from "jsr:@supabase/supabase-js";
import { corsHeaders } from "./cors.ts";

interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface BookingPayload {
  carId: string; // UUID
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  customerDetails: CustomerDetails;
  totalPrice: number;
  currency: string;
  securityDepositAmount: number;
  secureTokenValue: string; // The actual token string
  tokenExpiresAt: string; // ISO string
  bookingDays: number;
  initialOverallStatus: string;
  initialPaymentStatus: string;
  initialContractStatus: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: BookingPayload = await req.json();

    // Input validation (basic - consider more robust validation)
    if (!payload.carId || !payload.startDate || !payload.endDate || !payload.customerDetails || !payload.secureTokenValue) {
      return new Response(JSON.stringify({ success: false, error: "missing_required_fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Use service role key for transactions
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );

    const { data, error } = await supabaseClient.rpc("create_booking_transactional", {
      p_car_id: payload.carId,
      p_start_date: payload.startDate,
      p_end_date: payload.endDate,
      p_customer_first_name: payload.customerDetails.firstName,
      p_customer_last_name: payload.customerDetails.lastName,
      p_customer_email: payload.customerDetails.email,
      p_customer_phone: payload.customerDetails.phone,
      p_total_price: payload.totalPrice,
      p_currency: payload.currency,
      p_security_deposit_amount: payload.securityDepositAmount,
      p_secure_token_value: payload.secureTokenValue,
      p_token_expires_at: payload.tokenExpiresAt,
      p_booking_days: payload.bookingDays,
      p_initial_overall_status: payload.initialOverallStatus,
      p_initial_payment_status: payload.initialPaymentStatus,
      p_initial_contract_status: payload.initialContractStatus,
    });

    if (error) {
      console.error("Error calling create_booking_transactional:", error);
      // Check if the error is from our PL/pgSQL function (which returns JSONB with a success property)
      if (error.details && typeof error.details === 'string') {
        try {
          const parsedDetails = JSON.parse(error.details);
          if (parsedDetails.success === false) {
            return new Response(JSON.stringify(parsedDetails), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: parsedDetails.error === 'dates_unavailable' ? 409 : 500,
            });
          }
        } catch (e) {
          // Not a JSON error detail, or malformed
        }
      }
      return new Response(JSON.stringify({ success: false, error: error.message || "rpc_error", details: error.details }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // The PL/pgSQL function returns a JSONB object. If it was successful, data will contain that object.
    // If it was an error handled within PL/pgSQL (e.g. dates_unavailable), it should have been caught above.
    if (data && data.success === false) {
       return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: data.error === 'dates_unavailable' ? 409 : (data.error === 'invalid_status_value' ? 400: 500),
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201, // Or 200 if preferred
    });

  } catch (err) {
    console.error("Unhandled error in edge function:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "unknown_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 