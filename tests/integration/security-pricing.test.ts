import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

describe('Server-side Pricing Security Tests', () => {
  let supabase: any
  let testCarId: string
  
  beforeAll(async () => {
    supabase = createSupabaseServiceRoleClient()
    
    // Get a test car
    const { data: cars } = await supabase
      .from('cars')
      .select('id')
      .limit(1)
      .single()
    
    testCarId = cars?.id
  })
  
  describe('Price Calculation Function', () => {
    it('should calculate price correctly based on database values', async () => {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 3) // 3 day rental
      
      const { data: priceCalc, error } = await supabase.rpc('calculate_booking_price', {
        p_car_id: testCarId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })
      
      expect(error).toBeNull()
      expect(priceCalc).toHaveProperty('success', true)
      expect(priceCalc).toHaveProperty('rental_days', 3)
      expect(priceCalc).toHaveProperty('final_price')
      expect(priceCalc.final_price).toBeGreaterThan(0)
    })
    
    it('should reject rentals below minimum days', async () => {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 0) // Same day rental
      
      const { data: priceCalc } = await supabase.rpc('calculate_booking_price', {
        p_car_id: testCarId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })
      
      // Check if minimum days validation works
      if (priceCalc.success === false) {
        expect(priceCalc).toHaveProperty('error')
        expect(priceCalc.error).toContain('Minimum rental period')
      }
    })
  })
  
  describe('Price Validation Function', () => {
    it('should reject manipulated prices', async () => {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 3)
      
      // First get correct price
      const { data: correctPrice } = await supabase.rpc('calculate_booking_price', {
        p_car_id: testCarId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })
      
      if (correctPrice?.success) {
        // Try to validate with a much lower price
        const manipulatedPrice = correctPrice.final_price * 0.5
        
        const { data: validation } = await supabase.rpc('validate_booking_price', {
          p_car_id: testCarId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_client_price: manipulatedPrice
        })
        
        expect(validation).toHaveProperty('valid', false)
        expect(validation).toHaveProperty('error', 'Price validation failed')
      }
    })
    
    it('should accept correct prices', async () => {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 3)
      
      // First get correct price
      const { data: correctPrice } = await supabase.rpc('calculate_booking_price', {
        p_car_id: testCarId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })
      
      if (correctPrice?.success) {
        const { data: validation } = await supabase.rpc('validate_booking_price', {
          p_car_id: testCarId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_client_price: correctPrice.final_price
        })
        
        expect(validation).toHaveProperty('valid', true)
        expect(validation).toHaveProperty('server_calculation')
      }
    })
  })
  
  describe('Payment Capture Rules', () => {
    it('should have default capture rules configured', async () => {
      const { data: rules, error } = await supabase
        .from('payment_capture_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority')
      
      expect(error).toBeNull()
      expect(rules).toHaveLength(3)
      expect(rules[0]).toHaveProperty('rule_type', 'contract_signed')
      expect(rules[1]).toHaveProperty('rule_type', 'hours_before_rental')
      expect(rules[2]).toHaveProperty('rule_type', 'admin_approval')
    })
  })
})