-- Add performance indexes for car availability, bookings, and reviews

-- Composite index on car_availability for efficient date-based car lookups
CREATE INDEX IF NOT EXISTS idx_car_availability_car_date 
ON car_availability(car_id, date);

-- Index on bookings for finding bookings by car and date range
CREATE INDEX IF NOT EXISTS idx_bookings_car_dates 
ON bookings(car_id, start_date, end_date);

-- Index on bookings for customer history and recent bookings
CREATE INDEX IF NOT EXISTS idx_bookings_customer_created 
ON bookings(customer_id, created_at);

-- Composite index on car_reviews for efficient approved review queries
CREATE INDEX IF NOT EXISTS idx_car_reviews_car_approved_created 
ON car_reviews(car_id, is_approved, created_at);

-- Add comments to document the purpose of each index
COMMENT ON INDEX idx_car_availability_car_date IS 'Optimize car availability lookups by car and date';
COMMENT ON INDEX idx_bookings_car_dates IS 'Optimize booking conflict checks and availability calculations';
COMMENT ON INDEX idx_bookings_customer_created IS 'Optimize customer booking history queries';
COMMENT ON INDEX idx_car_reviews_car_approved_created IS 'Optimize approved review queries with pagination';