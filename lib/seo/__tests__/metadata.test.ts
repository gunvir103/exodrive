import { describe, it, expect } from 'bun:test';
import { 
  createPageMetadata, 
  createCarMetadata,
  createFleetMetadata,
  createBookingMetadata,
  createLocationMetadata,
  generateDynamicTitle,
  generateDynamicDescription,
  generateFAQKeywords
} from '../metadata';
import type { Car } from '@/lib/types/car';

describe('SEO Metadata Generation', () => {
  describe('createPageMetadata', () => {
    it('should generate default metadata when no options provided', () => {
      const metadata = createPageMetadata({});
      
      expect(metadata.title).toBe('ExoDrive Exotic Car Rentals - Luxury & Exotic Car Rentals in DMV');
      expect(metadata.description).toContain('Premium luxury and exotic car rental service');
      expect(metadata.keywords).toContain('exotic car rental');
      expect(metadata.openGraph?.title).toBeDefined();
    });

    it('should merge custom keywords with default keywords', () => {
      const metadata = createPageMetadata({
        keywords: ['custom', 'test', 'keywords'] // Pass as array, not string
      });
      
      // Keywords should be a comma-separated string
      expect(typeof metadata.keywords).toBe('string');
      expect(metadata.keywords).toContain('custom');
      expect(metadata.keywords).toContain('test');
      expect(metadata.keywords).toContain('exotic car rental'); // Default still included
    });

    it('should handle custom canonical URLs', () => {
      const customUrl = 'https://www.exodrive.co/special-page';
      const metadata = createPageMetadata({
        canonical: customUrl
      });
      
      expect(metadata.alternates?.canonical).toBe(customUrl);
      expect(metadata.openGraph?.url).toBe(customUrl);
    });

    it('should respect noIndex flag', () => {
      const metadata = createPageMetadata({
        noIndex: true
      });
      
      expect(metadata.robots?.index).toBe(false);
      expect(metadata.robots?.follow).toBe(false); // noIndex sets both to false
    });
  });

  describe('createCarMetadata', () => {
    const mockCar: Car = {
      id: 'test-123',
      name: 'Ferrari 488 GTB',
      description: 'Experience Italian engineering excellence',
      shortDescription: 'Supercar perfection',
      category: 'Exotic',
      isAvailable: true,
      pricePerDay: 2500,
      imageUrls: ['/images/ferrari-front.jpg'],
      make: 'Ferrari',
      model: '488 GTB',
      year: 2021,
      engine: '3.9L V8 Twin Turbo',
      horsepower: 661,
      acceleration060: 3.0,
      topSpeed: 205,
      transmission: 'Automatic',
      drivetrain: 'RWD',
      seatingCapacity: 2,
      fuelType: 'Gasoline'
    };

    it('should generate car-specific title and description', () => {
      const metadata = createCarMetadata(mockCar, 'ferrari-488');
      
      expect(metadata.title).toContain('Ferrari 488 GTB');
      expect(metadata.title).toContain('Rent');
      expect(metadata.title).toContain('$2500/day'); // Price is in title (no comma)
      // The description uses the car's shortDescription if available
      expect(metadata.description).toBe('Supercar perfection');
    });

    it('should handle missing car properties gracefully', () => {
      const carWithMissing = { ...mockCar, pricePerDay: null, imageUrls: [] };
      const metadata = createCarMetadata(carWithMissing, 'ferrari-488');
      
      expect(metadata).toBeDefined();
      expect(metadata.title).toContain('Ferrari 488 GTB');
      // Should not include price when pricing is null
      expect(metadata.description).not.toContain('$');
    });

    it('should include performance-based keywords for high-power cars', () => {
      const metadata = createCarMetadata(mockCar, 'ferrari-488');
      const keywords = metadata.keywords || '';
      
      expect(keywords).toContain('ferrari rental');
      // Keywords are generated based on make, not model
      expect(keywords).toContain('exotic');
      expect(keywords).toContain('supercar'); // High HP triggers this
    });

    it('should use primary image for OpenGraph', () => {
      const metadata = createCarMetadata(mockCar, 'ferrari-488');
      
      expect(metadata.openGraph?.images?.[0]?.url).toContain('/images/ferrari-front.jpg');
      expect(metadata.openGraph?.images?.[0]?.alt).toContain('Ferrari');
    });
  });

  describe('createFleetMetadata', () => {
    it('should generate fleet page metadata with appropriate title and keywords', () => {
      const metadata = createFleetMetadata();
      
      expect(metadata.title).toContain('Exotic Car Fleet');
      expect(metadata.description).toContain('luxury and exotic cars');
      expect(metadata.description).toContain('Ferrari');
      expect(metadata.keywords).toContain('exotic car rental');
    });
  });

  describe('createBookingMetadata', () => {
    it('should generate booking page metadata with CTAs', () => {
      const metadata = createBookingMetadata();
      
      expect(metadata.title).toContain('Book Your Exotic Car Rental');
      expect(metadata.description).toContain('Book your luxury');
      expect(metadata.keywords).toContain('book exotic car rental');
      expect(metadata.keywords).toContain('reserve luxury car');
    });
  });

  describe('createLocationMetadata', () => {
    it('should generate location-specific metadata', () => {
      const metadata = createLocationMetadata('Washington DC');
      
      expect(metadata.title).toContain('Exotic Car Rentals in Washington DC');
      expect(metadata.description).toContain('Washington DC');
      expect(metadata.keywords).toContain('exotic car rental washington dc');
      expect(metadata.alternates?.canonical).toContain('/locations/washington-dc');
    });
  });

  describe('generateDynamicTitle', () => {
    it('should combine title parts with location and price', () => {
      const title = generateDynamicTitle(
        ['Rent', 'Ferrari 488'],
        'Washington DC',
        '$1,500'
      );
      
      expect(title).toBe('Rent Ferrari 488 in Washington DC from $1,500');
    });

    it('should handle missing optional parameters', () => {
      const title = generateDynamicTitle(['Luxury Car Rental']);
      expect(title).toBe('Luxury Car Rental');
    });
  });

  describe('generateDynamicDescription', () => {
    it('should generate description with features and CTA', () => {
      const desc = generateDynamicDescription(
        'Experience luxury driving',
        ['V8 engine', '600 HP', 'Convertible'],
        'Maryland',
        'Reserve today!'
      );
      
      expect(desc).toContain('Experience luxury driving in Maryland');
      expect(desc).toContain('V8 engine');
      expect(desc).toContain('Reserve today!');
    });
  });

  describe('generateFAQKeywords', () => {
    it('should extract keywords from FAQ questions', () => {
      const faqs = [
        { question: 'What are the prices for exotic car rentals?', answer: 'Prices vary' },
        { question: 'Do you offer delivery service?', answer: 'Yes we do' },
        { question: 'What insurance is required?', answer: 'Full coverage' }
      ];
      
      const keywords = generateFAQKeywords(faqs);
      
      expect(keywords).toContain('exotic car rental prices');
      expect(keywords).toContain('exotic car delivery service');
      expect(keywords).toContain('exotic car rental insurance');
    });

    it('should remove duplicate keywords', () => {
      const faqs = [
        { question: 'What is the cost?', answer: 'Varies' },
        { question: 'How much does it cost?', answer: 'Depends' },
        { question: 'Tell me about pricing', answer: 'See website' }
      ];
      
      const keywords = generateFAQKeywords(faqs);
      const priceKeywords = keywords.filter(k => k.includes('price') || k.includes('cost'));
      
      // Should only have unique price-related keywords
      expect(priceKeywords.length).toBeLessThanOrEqual(2);
    });
  });
});