-- Create car_reviews table
CREATE TABLE IF NOT EXISTS car_reviews (
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

-- Create indexes
CREATE INDEX idx_car_reviews_car_id ON car_reviews(car_id);
CREATE INDEX idx_car_reviews_customer_id ON car_reviews(customer_id);
CREATE INDEX idx_car_reviews_booking_id ON car_reviews(booking_id);
CREATE INDEX idx_car_reviews_approved ON car_reviews(is_approved) WHERE is_approved = true;

-- Create updated_at trigger
CREATE TRIGGER update_car_reviews_updated_at
    BEFORE UPDATE ON car_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE car_reviews ENABLE ROW LEVEL SECURITY;

-- Public users can read approved reviews
CREATE POLICY "Public users can view approved reviews" 
    ON car_reviews FOR SELECT 
    TO public 
    USING (is_approved = true);

-- Authenticated customers can create reviews for their completed bookings
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

-- Customers can update their own reviews (before approval)
CREATE POLICY "Customers can update their own unapproved reviews" 
    ON car_reviews FOR UPDATE 
    TO authenticated 
    USING (
        auth.uid() IN (
            SELECT user_id FROM customers WHERE id = customer_id
        ) AND is_approved = false
    );

-- Service role has full access (for admin operations)
CREATE POLICY "Service role has full access to reviews" 
    ON car_reviews 
    FOR ALL 
    TO service_role 
    USING (true);

-- Create a function to calculate average rating for a car
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

-- Add average_rating column to cars table
ALTER TABLE cars ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Create function to update car rating stats
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

-- Create trigger to update car stats when reviews change
CREATE TRIGGER update_car_stats_on_review_change
    AFTER INSERT OR UPDATE OR DELETE ON car_reviews
    FOR EACH ROW
    WHEN (
        (TG_OP = 'INSERT' AND NEW.is_approved = true) OR
        (TG_OP = 'UPDATE' AND (OLD.is_approved != NEW.is_approved OR OLD.rating != NEW.rating)) OR
        (TG_OP = 'DELETE' AND OLD.is_approved = true)
    )
    EXECUTE FUNCTION update_car_rating_stats();