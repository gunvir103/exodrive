-- Critical Performance Indexes Migration
-- This migration adds missing indexes identified in performance review
-- Author: Database Performance Specialist
-- Date: 2025-06-23

-- ============================================
-- BOOKINGS TABLE INDEXES
-- ============================================

-- Index for filtering bookings by status (frequently used in admin panel)
-- Supports queries filtering by overall_status and payment_status
CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON bookings(overall_status, payment_status);
COMMENT ON INDEX idx_bookings_status IS 'Optimize status-based filtering in admin panel and reports';

-- Index for payment lookups (if payment_id column exists)
-- Note: This assumes payment_id was added in a previous migration
-- Uncomment if payment_id column exists
-- CREATE INDEX IF NOT EXISTS idx_bookings_payment_id 
-- ON bookings(payment_id);
-- COMMENT ON INDEX idx_bookings_payment_id IS 'Optimize payment relationship lookups';

-- Composite index for date range queries with car
-- Supports availability checks and conflict detection
CREATE INDEX IF NOT EXISTS idx_bookings_car_status_dates 
ON bookings(car_id, overall_status, start_date, end_date);
COMMENT ON INDEX idx_bookings_car_status_dates IS 'Optimize car availability and booking conflict queries';

-- Index for customer booking history with status filter
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status_created 
ON bookings(customer_id, overall_status, created_at DESC);
COMMENT ON INDEX idx_bookings_customer_status_created IS 'Optimize customer booking history with status filtering';

-- Index for contract status queries
CREATE INDEX IF NOT EXISTS idx_bookings_contract_status 
ON bookings(contract_status) 
WHERE contract_status NOT IN ('not_sent', 'signed');
COMMENT ON INDEX idx_bookings_contract_status IS 'Optimize queries for bookings pending contract actions';

-- Index for security token lookups
CREATE INDEX IF NOT EXISTS idx_bookings_secure_token 
ON bookings(secure_token_id);
COMMENT ON INDEX idx_bookings_secure_token IS 'Optimize secure token-based booking lookups';

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- Index for payment status and booking relationship
CREATE INDEX IF NOT EXISTS idx_payments_booking_status 
ON payments(booking_id, status);
COMMENT ON INDEX idx_payments_booking_status IS 'Optimize payment queries by booking and status';

-- Index for PayPal order ID lookups
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order 
ON payments(paypal_order_id) 
WHERE paypal_order_id IS NOT NULL;
COMMENT ON INDEX idx_payments_paypal_order IS 'Optimize PayPal webhook processing';

-- Index for PayPal authorization ID lookups
CREATE INDEX IF NOT EXISTS idx_payments_paypal_auth 
ON payments(paypal_authorization_id) 
WHERE paypal_authorization_id IS NOT NULL;
COMMENT ON INDEX idx_payments_paypal_auth IS 'Optimize PayPal authorization lookups';

-- Index for payment method analytics
CREATE INDEX IF NOT EXISTS idx_payments_method_created 
ON payments(payment_method, created_at DESC);
COMMENT ON INDEX idx_payments_method_created IS 'Optimize payment method analytics and reporting';

-- ============================================
-- CUSTOMERS TABLE INDEXES
-- ============================================

-- Index for email lookups (in addition to unique constraint)
CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
ON customers(LOWER(email));
COMMENT ON INDEX idx_customers_email_lower IS 'Optimize case-insensitive email searches';

-- ============================================
-- CAR_AVAILABILITY TABLE INDEXES
-- ============================================

-- Composite index for availability status queries
CREATE INDEX IF NOT EXISTS idx_car_availability_status_date 
ON car_availability(status, date);
COMMENT ON INDEX idx_car_availability_status_date IS 'Optimize availability status filtering by date';

-- ============================================
-- BOOKING_EVENTS TABLE INDEXES
-- ============================================

-- Index for event type queries
CREATE INDEX IF NOT EXISTS idx_booking_events_type_timestamp 
ON booking_events(event_type, timestamp DESC);
COMMENT ON INDEX idx_booking_events_type_timestamp IS 'Optimize event type filtering and timeline queries';

-- Index for actor-based queries
CREATE INDEX IF NOT EXISTS idx_booking_events_actor 
ON booking_events(actor_type, actor_id) 
WHERE actor_id IS NOT NULL;
COMMENT ON INDEX idx_booking_events_actor IS 'Optimize queries by actor (admin, customer, system)';

-- ============================================
-- CARS TABLE INDEXES
-- ============================================

-- Index for available and featured car queries
CREATE INDEX IF NOT EXISTS idx_cars_available_featured 
ON cars(available, featured, created_at DESC) 
WHERE hidden = false OR hidden IS NULL;
COMMENT ON INDEX idx_cars_available_featured IS 'Optimize public car listing queries';

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_cars_category_available 
ON cars(category, available) 
WHERE hidden = false OR hidden IS NULL;
COMMENT ON INDEX idx_cars_category_available IS 'Optimize category-based car searches';

-- Index for slug lookups (frequently used in URLs)
CREATE INDEX IF NOT EXISTS idx_cars_slug 
ON cars(slug);
COMMENT ON INDEX idx_cars_slug IS 'Optimize URL-based car lookups';

-- ============================================
-- CAR_PRICING TABLE INDEXES
-- ============================================

-- Index for active pricing lookups
CREATE INDEX IF NOT EXISTS idx_car_pricing_car_active 
ON car_pricing(car_id) 
WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_car_pricing_car_active IS 'Optimize active pricing lookups for cars';

-- ============================================
-- CAR_REVIEWS TABLE INDEXES (Already exists in previous migration)
-- ============================================
-- Skipping as idx_car_reviews_car_approved_created already exists

-- ============================================
-- BOOKING_SECURE_TOKENS TABLE INDEXES
-- ============================================

-- Index for token value lookups
CREATE INDEX IF NOT EXISTS idx_booking_secure_tokens_value 
ON booking_secure_tokens(token_value);
COMMENT ON INDEX idx_booking_secure_tokens_value IS 'Optimize secure token validation';

-- Index for token expiration checks
CREATE INDEX IF NOT EXISTS idx_booking_secure_tokens_expires 
ON booking_secure_tokens(expires_at) 
WHERE is_used = false;
COMMENT ON INDEX idx_booking_secure_tokens_expires IS 'Optimize token expiration cleanup queries';

-- ============================================
-- INBOX_EMAILS TABLE INDEXES
-- ============================================

-- Index for email status and date queries
CREATE INDEX IF NOT EXISTS idx_inbox_emails_status_received 
ON inbox_emails(status, received_at DESC);
COMMENT ON INDEX idx_inbox_emails_status_received IS 'Optimize inbox email queries by status and date';

-- Index for from email searches
CREATE INDEX IF NOT EXISTS idx_inbox_emails_from 
ON inbox_emails(from_email);
COMMENT ON INDEX idx_inbox_emails_from IS 'Optimize email sender searches';

-- ============================================
-- ANALYTICS INDEXES
-- ============================================

-- Materialized view for booking statistics (optional - uncomment if needed)
-- CREATE MATERIALIZED VIEW IF NOT EXISTS mv_booking_stats AS
-- SELECT 
--   DATE_TRUNC('day', created_at) as booking_date,
--   COUNT(*) as total_bookings,
--   COUNT(*) FILTER (WHERE overall_status = 'completed') as completed_bookings,
--   COUNT(*) FILTER (WHERE overall_status = 'cancelled') as cancelled_bookings,
--   SUM(total_price) FILTER (WHERE overall_status = 'completed') as revenue,
--   AVG(booking_days) as avg_booking_days
-- FROM bookings
-- GROUP BY DATE_TRUNC('day', created_at);
-- 
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_booking_stats_date 
-- ON mv_booking_stats(booking_date);

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Enable pg_stat_statements for query performance monitoring (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create a function to analyze index usage
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE (
  schema_name text,
  table_name text,
  index_name text,
  index_scan_count bigint,
  index_size text,
  table_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname::text,
    tablename::text,
    indexname::text,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)),
    pg_size_pretty(pg_relation_size(indrelid))
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION analyze_index_usage() IS 'Analyze index usage statistics to identify unused or underutilized indexes';

-- ============================================
-- NOTES
-- ============================================
-- 1. Monitor index usage with: SELECT * FROM analyze_index_usage();
-- 2. Consider adding payment_id to bookings table if not already present
-- 3. Run ANALYZE after creating indexes to update statistics
-- 4. Monitor query performance with pg_stat_statements
-- 5. Consider partitioning large tables (bookings, booking_events) by date in the future

-- Run ANALYZE to update table statistics
ANALYZE bookings;
ANALYZE payments;
ANALYZE customers;
ANALYZE cars;
ANALYZE car_availability;
ANALYZE booking_events;