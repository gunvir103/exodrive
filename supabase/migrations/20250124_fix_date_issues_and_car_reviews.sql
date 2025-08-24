-- Migration: Fix date type issues and car_reviews table structure
-- Issue: EXO-130 - Database Schema Issue - Incorrect Date Storage
-- Author: System
-- Date: 2025-01-24

-- ============================================================================
-- SUMMARY OF ISSUES FOUND:
-- 1. car_availability.date: Already fixed (TEXT -> DATE) in migration 20240517000000
-- 2. car_reviews table: Has old structure from 20240320, needs complete rebuild
-- 3. Performance: Missing some useful indexes for date range queries
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Fix car_reviews table structure
-- The table was created with wrong structure in 20240320 and the newer 
-- migration (20250115) didn't run because of IF NOT EXISTS clause
-- ============================================================================

-- Step 1: Drop the old car_reviews table (no data exists, verified)
DROP TABLE IF EXISTS car_reviews CASCADE;

-- Step 2: Recreate with proper structure from 20250115 migration
CREATE TABLE car_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT false, -- Verified means the reviewer actually rented the car
    is_approved BOOLEAN DEFAULT false, -- Admin approval before display
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes for car_reviews
CREATE INDEX idx_car_reviews_car_id ON car_reviews(car_id);
CREATE INDEX idx_car_reviews_customer_id ON car_reviews(customer_id);
CREATE INDEX idx_car_reviews_booking_id ON car_reviews(booking_id);
CREATE INDEX idx_car_reviews_approved ON car_reviews(is_approved) WHERE is_approved = true;
CREATE INDEX idx_car_reviews_created_at ON car_reviews(created_at DESC);

-- Step 4: Create updated_at trigger for car_reviews
CREATE TRIGGER update_car_reviews_updated_at
    BEFORE UPDATE ON car_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Step 5: Enable RLS on car_reviews
ALTER TABLE car_reviews ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for car_reviews
CREATE POLICY "Public users can view approved reviews" 
    ON car_reviews FOR SELECT 
    TO public 
    USING (is_approved = true);

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
        ) AND is_approved = false
    );

CREATE POLICY "Service role has full access to reviews" 
    ON car_reviews 
    FOR ALL 
    TO service_role 
    USING (true);

-- ============================================================================
-- PART 2: Car reviews helper functions
-- ============================================================================

-- Function to calculate average rating for a car
CREATE OR REPLACE FUNCTION calculate_car_average_rating(p_car_id UUID)
RETURNS NUMERIC(3,2) AS $$
DECLARE
    avg_rating NUMERIC(3,2);
BEGIN
    SELECT ROUND(AVG(rating)::numeric, 2)
    INTO avg_rating
    FROM car_reviews
    WHERE car_id = p_car_id
    AND is_approved = true;
    
    RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Add average_rating and review_count columns to cars table if not exists
ALTER TABLE cars ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Function to update car rating stats
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
        ),
        review_count = (
            SELECT COUNT(*)
            FROM car_reviews
            WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
            AND is_approved = true
        )
    WHERE id = COALESCE(NEW.car_id, OLD.car_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update car stats when reviews change
CREATE TRIGGER update_car_stats_on_review_change
    AFTER INSERT OR UPDATE OR DELETE ON car_reviews
    FOR EACH ROW
    WHEN (
        (TG_OP = 'INSERT' AND NEW.is_approved = true) OR
        (TG_OP = 'UPDATE' AND (OLD.is_approved != NEW.is_approved OR OLD.rating != NEW.rating)) OR
        (TG_OP = 'DELETE' AND OLD.is_approved = true)
    )
    EXECUTE FUNCTION update_car_rating_stats();

-- ============================================================================
-- PART 3: Performance optimizations for car_availability
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
-- PART 4: Data validation constraints
-- ============================================================================

-- Add constraint to ensure reasonable date ranges for car_availability
ALTER TABLE car_availability 
ADD CONSTRAINT IF NOT EXISTS reasonable_availability_dates 
CHECK (date >= '2020-01-01'::date AND date <= (CURRENT_DATE + INTERVAL '2 years')::date);

-- Add constraint to ensure booking dates are reasonable
ALTER TABLE bookings
ADD CONSTRAINT IF NOT EXISTS reasonable_booking_dates
CHECK (
    start_date >= '2020-01-01'::date 
    AND end_date <= (CURRENT_DATE + INTERVAL '2 years')::date
    AND end_date >= start_date
);

-- ============================================================================
-- PART 5: Create helper view for availability analysis
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
-- PART 6: Documentation
-- ============================================================================

COMMENT ON TABLE car_reviews IS 'Customer reviews for cars with booking verification';
COMMENT ON COLUMN car_reviews.is_verified IS 'True if reviewer actually rented the car';
COMMENT ON COLUMN car_reviews.is_approved IS 'Admin approval required before public display';

COMMENT ON INDEX idx_car_availability_available_dates IS 'Optimized for finding available dates';
COMMENT ON INDEX idx_car_availability_date_range IS 'Optimized for date range queries';
COMMENT ON INDEX idx_car_availability_status IS 'Optimized for non-available status filtering';

-- ============================================================================
-- VERIFICATION QUERIES (commented out, for testing)
-- ============================================================================

-- Verify car_availability uses DATE type:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'car_availability' AND column_name = 'date';

-- Verify car_reviews structure:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'car_reviews' ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname, indexdef FROM pg_indexes 
-- WHERE tablename IN ('car_availability', 'car_reviews');

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- BEGIN;
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
-- ALTER TABLE car_availability DROP CONSTRAINT IF EXISTS reasonable_availability_dates;
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS reasonable_booking_dates;
-- 
-- -- Drop view
-- DROP VIEW IF EXISTS car_availability_summary;
-- 
-- COMMIT;