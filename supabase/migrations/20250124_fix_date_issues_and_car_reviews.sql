-- Migration: Fix date type issues and car_reviews table structure
-- Issue: EXO-130 - Database Schema Issue - Incorrect Date Storage
-- Author: System
-- Date: 2025-01-24
-- Updated: 2025-01-24 - Added audit trail, soft deletes, and validation improvements

-- ============================================================================
-- SUMMARY OF ISSUES FOUND:
-- 1. car_availability.date: Already fixed (TEXT -> DATE) in migration 20240517000000
-- 2. car_reviews table: Has old structure from 20240320, needs complete rebuild
-- 3. Performance: Missing some useful indexes for date range queries
-- 4. Additional improvements: Audit trail, soft deletes, review responses
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Fix car_reviews table structure with enhancements
-- The table was created with wrong structure in 20240320 and the newer 
-- migration (20250115) didn't run because of IF NOT EXISTS clause
-- ============================================================================

-- Step 1: Drop the old car_reviews table (no data exists, verified)
DROP TABLE IF EXISTS car_reviews CASCADE;

-- Step 2: Recreate with enhanced structure including audit trail and soft deletes
CREATE TABLE car_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(255) NOT NULL CHECK (reviewer_name != '' AND LENGTH(reviewer_name) >= 2),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT CHECK (comment IS NULL OR LENGTH(comment) >= 10), -- Ensure meaningful comments
    is_verified BOOLEAN DEFAULT false, -- Verified means the reviewer actually rented the car
    is_approved BOOLEAN DEFAULT false, -- Admin approval before display
    
    -- Audit trail columns
    approved_by UUID REFERENCES customers(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES customers(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes for car_reviews with soft delete awareness
CREATE INDEX idx_car_reviews_car_id ON car_reviews(car_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_car_reviews_customer_id ON car_reviews(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_car_reviews_booking_id ON car_reviews(booking_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_car_reviews_approved ON car_reviews(is_approved) WHERE is_approved = true AND deleted_at IS NULL;
CREATE INDEX idx_car_reviews_created_at ON car_reviews(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_car_reviews_deleted ON car_reviews(deleted_at) WHERE deleted_at IS NOT NULL;

-- Step 4: Create updated_at trigger for car_reviews
-- Note: Both update_modified_column and update_updated_at_column exist in production
-- Using update_modified_column as it was created first and is more widely used
CREATE TRIGGER update_car_reviews_updated_at
    BEFORE UPDATE ON car_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Step 5: Enable RLS on car_reviews
ALTER TABLE car_reviews ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for car_reviews with soft delete awareness
CREATE POLICY "Public users can view approved non-deleted reviews" 
    ON car_reviews FOR SELECT 
    TO public 
    USING (is_approved = true AND deleted_at IS NULL);

CREATE POLICY "Customers can create reviews for their bookings" 
    ON car_reviews FOR INSERT 
    TO authenticated 
    WITH CHECK (
        auth.uid() IN (
            SELECT c.user_id 
            FROM customers c 
            INNER JOIN bookings b ON b.customer_id = c.id
            WHERE b.id = booking_id 
            AND b.overall_status = 'completed'
        )
    );

CREATE POLICY "Customers can update their own unapproved reviews" 
    ON car_reviews FOR UPDATE 
    TO authenticated 
    USING (
        auth.uid() IN (
            SELECT user_id FROM customers WHERE id = customer_id
        ) AND is_approved = false AND deleted_at IS NULL
    );

CREATE POLICY "Service role has full access to reviews" 
    ON car_reviews 
    FOR ALL 
    TO service_role 
    USING (true);

-- ============================================================================
-- PART 2: Create car review responses table for owner engagement
-- ============================================================================

CREATE TABLE car_review_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES car_reviews(id) ON DELETE CASCADE,
    responder_id UUID REFERENCES customers(id),
    responder_type VARCHAR(50) CHECK (responder_type IN ('owner', 'admin', 'support')),
    response TEXT NOT NULL CHECK (LENGTH(response) >= 10),
    is_public BOOLEAN DEFAULT true,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES customers(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure only one active response per review from owner
    UNIQUE(review_id, responder_type) WHERE deleted_at IS NULL AND responder_type = 'owner'
);

-- Create indexes for review responses
CREATE INDEX idx_car_review_responses_review_id ON car_review_responses(review_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_car_review_responses_responder ON car_review_responses(responder_id) WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_car_review_responses_updated_at
    BEFORE UPDATE ON car_review_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable RLS for review responses
ALTER TABLE car_review_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for review responses
CREATE POLICY "Public can view public responses" 
    ON car_review_responses FOR SELECT 
    TO public 
    USING (is_public = true AND deleted_at IS NULL);

CREATE POLICY "Authorized users can create responses" 
    ON car_review_responses FOR INSERT 
    TO authenticated 
    WITH CHECK (
        auth.uid() IN (SELECT user_id FROM customers WHERE id = responder_id)
    );

CREATE POLICY "Users can update their own responses" 
    ON car_review_responses FOR UPDATE 
    TO authenticated 
    USING (
        auth.uid() IN (SELECT user_id FROM customers WHERE id = responder_id)
        AND deleted_at IS NULL
    );

CREATE POLICY "Service role has full access to responses" 
    ON car_review_responses 
    FOR ALL 
    TO service_role 
    USING (true);

-- ============================================================================
-- PART 3: Car reviews helper functions (updated for soft deletes)
-- ============================================================================

-- Function to calculate average rating for a car (excluding soft deleted)
CREATE OR REPLACE FUNCTION calculate_car_average_rating(p_car_id UUID)
RETURNS NUMERIC(3,2) AS $$
DECLARE
    avg_rating NUMERIC(3,2);
BEGIN
    SELECT ROUND(AVG(rating)::numeric, 2)
    INTO avg_rating
    FROM car_reviews
    WHERE car_id = p_car_id
    AND is_approved = true
    AND deleted_at IS NULL;
    
    RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Add average_rating and review_count columns to cars table if not exists
ALTER TABLE cars ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Function to update car rating stats (soft delete aware)
CREATE OR REPLACE FUNCTION update_car_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update average rating and count for the car
    UPDATE cars
    SET 
        average_rating = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM car_reviews
            WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
            AND is_approved = true
            AND deleted_at IS NULL
        ),
        review_count = (
            SELECT COUNT(*)
            FROM car_reviews
            WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
            AND is_approved = true
            AND deleted_at IS NULL
        )
    WHERE id = COALESCE(NEW.car_id, OLD.car_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update car stats when reviews change (including soft deletes)
CREATE TRIGGER update_car_stats_on_review_change
    AFTER INSERT OR UPDATE OR DELETE ON car_reviews
    FOR EACH ROW
    WHEN (
        (TG_OP = 'INSERT' AND NEW.is_approved = true) OR
        (TG_OP = 'UPDATE' AND (
            OLD.is_approved != NEW.is_approved OR 
            OLD.rating != NEW.rating OR
            (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) OR
            (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)
        )) OR
        (TG_OP = 'DELETE' AND OLD.is_approved = true)
    )
    EXECUTE FUNCTION update_car_rating_stats();

-- ============================================================================
-- PART 4: Audit trail function for review approval/rejection
-- ============================================================================

CREATE OR REPLACE FUNCTION log_review_approval_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log approval event
    IF NEW.is_approved = true AND OLD.is_approved = false THEN
        INSERT INTO booking_events (
            booking_id,
            event_type,
            timestamp,
            actor_type,
            actor_id,
            details,
            summary_text
        )
        VALUES (
            NEW.booking_id,
            'review_approved',
            NOW(),
            'admin',
            NEW.approved_by::text,
            jsonb_build_object(
                'review_id', NEW.id,
                'rating', NEW.rating,
                'approved_at', NEW.approved_at
            ),
            'Review approved by admin'
        );
    -- Log rejection event
    ELSIF NEW.is_approved = false AND OLD.is_approved = true THEN
        INSERT INTO booking_events (
            booking_id,
            event_type,
            timestamp,
            actor_type,
            actor_id,
            details,
            summary_text
        )
        VALUES (
            NEW.booking_id,
            'review_rejected',
            NOW(),
            'admin',
            NEW.approved_by::text,
            jsonb_build_object(
                'review_id', NEW.id,
                'rejection_reason', NEW.rejection_reason
            ),
            'Review rejected: ' || COALESCE(NEW.rejection_reason, 'No reason provided')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for review approval logging
CREATE TRIGGER log_review_approval
    AFTER UPDATE OF is_approved ON car_reviews
    FOR EACH ROW
    WHEN (OLD.is_approved IS DISTINCT FROM NEW.is_approved AND NEW.booking_id IS NOT NULL)
    EXECUTE FUNCTION log_review_approval_event();

-- ============================================================================
-- PART 5: Performance optimizations for car_availability
-- ============================================================================

-- Add partial index for available dates (most common query)
CREATE INDEX IF NOT EXISTS idx_car_availability_available_dates
ON car_availability(car_id, date)
WHERE status = 'available';

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_car_availability_date_range
ON car_availability USING btree (date)
WHERE date >= CURRENT_DATE; -- Only index future dates

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_car_availability_status
ON car_availability(status, date)
WHERE status != 'available'; -- Index non-available statuses

-- Add composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_car_availability_lookup
ON car_availability(car_id, date, status);

-- ============================================================================
-- PART 6: Data validation constraints with improved naming
-- ============================================================================

-- Add constraint to ensure reasonable date ranges for car_availability
ALTER TABLE car_availability 
ADD CONSTRAINT IF NOT EXISTS car_availability_reasonable_dates 
CHECK (date >= '2020-01-01'::date AND date <= (CURRENT_DATE + INTERVAL '2 years')::date);

-- Add constraint to ensure booking dates are reasonable
ALTER TABLE bookings
ADD CONSTRAINT IF NOT EXISTS bookings_reasonable_dates
CHECK (
    start_date >= '2020-01-01'::date 
    AND end_date <= (CURRENT_DATE + INTERVAL '2 years')::date
    AND end_date >= start_date
);

-- ============================================================================
-- PART 7: Create helper view for availability analysis
-- ============================================================================

CREATE OR REPLACE VIEW car_availability_summary AS
SELECT 
    car_id,
    DATE_TRUNC('month', date) as month,
    COUNT(*) FILTER (WHERE status = 'available') as available_days,
    COUNT(*) FILTER (WHERE status = 'booked') as booked_days,
    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_days,
    COUNT(*) FILTER (WHERE status = 'pending_confirmation') as pending_days,
    COUNT(*) as total_days,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'booked') / NULLIF(COUNT(*), 0), 
        2
    ) as occupancy_rate
FROM car_availability
WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY car_id, DATE_TRUNC('month', date);

COMMENT ON VIEW car_availability_summary IS 'Monthly availability and occupancy statistics for cars';

-- ============================================================================
-- PART 8: Enhanced review analytics view
-- ============================================================================

CREATE OR REPLACE VIEW car_review_analytics AS
SELECT 
    cr.car_id,
    c.name as car_name,
    COUNT(cr.id) FILTER (WHERE cr.deleted_at IS NULL) as total_reviews,
    COUNT(cr.id) FILTER (WHERE cr.is_approved = true AND cr.deleted_at IS NULL) as approved_reviews,
    COUNT(cr.id) FILTER (WHERE cr.is_verified = true AND cr.deleted_at IS NULL) as verified_reviews,
    ROUND(AVG(cr.rating) FILTER (WHERE cr.is_approved = true AND cr.deleted_at IS NULL), 2) as average_rating,
    COUNT(DISTINCT crr.id) FILTER (WHERE crr.deleted_at IS NULL) as total_responses,
    MAX(cr.created_at) as latest_review_date
FROM cars c
LEFT JOIN car_reviews cr ON c.id = cr.car_id
LEFT JOIN car_review_responses crr ON cr.id = crr.review_id
GROUP BY cr.car_id, c.name;

COMMENT ON VIEW car_review_analytics IS 'Analytics dashboard for car reviews and responses';

-- ============================================================================
-- PART 9: Documentation
-- ============================================================================

COMMENT ON TABLE car_reviews IS 'Customer reviews for cars with booking verification, audit trail, and soft delete support';
COMMENT ON COLUMN car_reviews.is_verified IS 'True if reviewer actually rented the car';
COMMENT ON COLUMN car_reviews.is_approved IS 'Admin approval required before public display';
COMMENT ON COLUMN car_reviews.approved_by IS 'Admin who approved/rejected the review';
COMMENT ON COLUMN car_reviews.approved_at IS 'Timestamp of approval/rejection';
COMMENT ON COLUMN car_reviews.rejection_reason IS 'Reason for review rejection';
COMMENT ON COLUMN car_reviews.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN car_reviews.deleted_by IS 'User who soft deleted the review';

COMMENT ON TABLE car_review_responses IS 'Responses to customer reviews from owners or support staff';
COMMENT ON COLUMN car_review_responses.responder_type IS 'Type of responder: owner, admin, or support';
COMMENT ON COLUMN car_review_responses.is_public IS 'Whether the response is publicly visible';

COMMENT ON INDEX idx_car_availability_available_dates IS 'Optimized for finding available dates';
COMMENT ON INDEX idx_car_availability_date_range IS 'Optimized for date range queries';
COMMENT ON INDEX idx_car_availability_status IS 'Optimized for non-available status filtering';

-- ============================================================================
-- VERIFICATION QUERIES (commented out, for testing)
-- ============================================================================

-- Verify both update functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN ('update_modified_column', 'update_updated_at_column');

-- Verify car_availability uses DATE type:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'car_availability' AND column_name = 'date';

-- Verify car_reviews structure:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'car_reviews' ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname, indexdef FROM pg_indexes 
-- WHERE tablename IN ('car_availability', 'car_reviews', 'car_review_responses');

-- Check constraints:
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('car_availability_reasonable_dates', 'bookings_reasonable_dates');

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- BEGIN;
-- 
-- -- Drop new tables
-- DROP TABLE IF EXISTS car_review_responses CASCADE;
-- 
-- -- Restore old car_reviews structure
-- DROP TABLE IF EXISTS car_reviews CASCADE;
-- CREATE TABLE car_reviews (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
--   name TEXT NOT NULL,
--   rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
--   date TEXT NOT NULL,
--   comment TEXT NOT NULL,
--   is_verified BOOLEAN NOT NULL DEFAULT false,
--   is_approved BOOLEAN NOT NULL DEFAULT false,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- 
-- -- Remove performance indexes
-- DROP INDEX IF EXISTS idx_car_availability_available_dates;
-- DROP INDEX IF EXISTS idx_car_availability_date_range;
-- DROP INDEX IF EXISTS idx_car_availability_status;
-- DROP INDEX IF EXISTS idx_car_availability_lookup;
-- 
-- -- Remove constraints
-- ALTER TABLE car_availability DROP CONSTRAINT IF EXISTS car_availability_reasonable_dates;
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_reasonable_dates;
-- 
-- -- Drop views
-- DROP VIEW IF EXISTS car_availability_summary;
-- DROP VIEW IF EXISTS car_review_analytics;
-- 
-- -- Drop functions
-- DROP FUNCTION IF EXISTS log_review_approval_event() CASCADE;
-- 
-- COMMIT;