import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDocuSealService } from '@/lib/services/docuseal-service';
import { z } from 'zod';

// Request validation schemas
const generateContractSchema = z.object({
  bookingId: z.string().uuid()
});

const resendContractSchema = z.object({
  bookingId: z.string().uuid()
});

const getContractStatusSchema = z.object({
  bookingId: z.string().uuid().optional(),
  submissionId: z.string().optional()
}).refine(data => data.bookingId || data.submissionId, {
  message: "Either bookingId or submissionId is required"
});

/**
 * GET /api/admin/contracts
 * Get contract status or download signed contracts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request.cookies as any);
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const submissionId = searchParams.get('submissionId');
    const action = searchParams.get('action');

    // Validate parameters
    const validation = getContractStatusSchema.safeParse({ bookingId, submissionId });
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const docusealService = getDocuSealService();

    // If action is download, get signed documents
    if (action === 'download' && submissionId) {
      const result = await docusealService.downloadSignedContract(submissionId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        documents: result.documents
      });
    }

    // Get submission ID from booking if needed
    let finalSubmissionId = submissionId;
    if (bookingId && !submissionId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('docuseal_submission_id')
        .eq('id', bookingId)
        .single();

      if (!booking?.docuseal_submission_id) {
        return NextResponse.json(
          { error: 'No contract found for this booking' },
          { status: 404 }
        );
      }
      
      finalSubmissionId = booking.docuseal_submission_id;
    }

    if (!finalSubmissionId) {
      return NextResponse.json(
        { error: 'Submission ID required' },
        { status: 400 }
      );
    }

    // Get contract status
    const result = await docusealService.getSubmissionStatus(finalSubmissionId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      data: result.data
    });

  } catch (error: any) {
    console.error('Error in GET /api/admin/contracts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contracts
 * Generate or resend contracts
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request.cookies as any);
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    const docusealService = getDocuSealService();

    switch (action) {
      case 'generate': {
        const validation = generateContractSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: validation.error.flatten() },
            { status: 400 }
          );
        }

        const result = await docusealService.generateContract(validation.data.bookingId);
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        // Log admin action
        await supabase.from('booking_events').insert({
          booking_id: validation.data.bookingId,
          event_type: 'contract_generated_by_admin',
          actor_type: 'admin',
          actor_id: user.id,
          actor_name: user.email,
          summary_text: 'Contract manually generated by admin',
          details: {
            submission_id: result.submissionId
          }
        });

        return NextResponse.json({
          success: true,
          submissionId: result.submissionId,
          message: 'Contract generated and sent successfully'
        });
      }

      case 'resend': {
        const validation = resendContractSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: validation.error.flatten() },
            { status: 400 }
          );
        }

        const result = await docusealService.resendContract(validation.data.bookingId);
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        // Log admin action
        await supabase.from('booking_events').insert({
          booking_id: validation.data.bookingId,
          event_type: 'contract_resent_by_admin',
          actor_type: 'admin',
          actor_id: user.id,
          actor_name: user.email,
          summary_text: 'Contract reminder sent by admin'
        });

        return NextResponse.json({
          success: true,
          message: 'Contract reminder sent successfully'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Error in POST /api/admin/contracts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/contracts
 * Update contract status or archive
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request.cookies as any);
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, submissionId } = body;

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID required' },
        { status: 400 }
      );
    }

    const docusealService = getDocuSealService();

    switch (action) {
      case 'archive': {
        const result = await docusealService.archiveSubmission(submissionId);
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        // Find and update booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('id')
          .eq('docuseal_submission_id', submissionId)
          .single();

        if (booking) {
          await supabase.from('booking_events').insert({
            booking_id: booking.id,
            event_type: 'contract_archived',
            actor_type: 'admin',
            actor_id: user.id,
            actor_name: user.email,
            summary_text: 'Contract archived by admin',
            details: { submission_id: submissionId }
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Contract archived successfully'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Error in PUT /api/admin/contracts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
