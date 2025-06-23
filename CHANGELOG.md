# Changelog

All notable changes to the ExoDrive project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Email inbox feature for admin dashboard - Phase 2 Complete
  - Fixed webhook handler column mappings for Resend integration
  - Added foreign key constraint for booking_id with ON DELETE SET NULL
  - Added performance indexes on resend_email_id, booking_id, created_at, recipient_email
  - Implemented upsert logic for proper email event tracking
  - Verified RLS policies and security settings

### Fixed
- Corrected column mapping mismatches in Resend webhook handler:
  - `resend_id` → `resend_email_id`
  - `from_email` → `sender_email`
  - `to_email` → `recipient_email`
  - `status` → `last_event_type`
- Added missing `raw_payload` field to store full webhook data
- Implemented proper update logic for existing email records

### Security
- Verified RLS policies are properly enabled on inbox_emails table
- Confirmed webhook signature validation is working correctly

## [1.1.0] - 2025-01-22

### Added
- Redis caching implementation - Phase 1 Complete
  - Distributed caching for car listings, availability, and details
  - Cache warming system with Bun-optimized parallel processing
  - Sliding window rate limiting (60-300 req/min tiers)
  - Graceful degradation when Redis is unavailable
- Comprehensive test suite with unit and integration tests
- Standardized error handling across all API routes
- Performance monitoring with X-Cache headers

### Changed
- API response times reduced by 95% (800ms → <50ms cached)
- Database query volume reduced by 70%
- Cache hit rate >85% after warm-up period

### Fixed
- PayPal webhook verification bypass vulnerability
- File upload validation and size limits
- Path traversal protection in file operations
- Replaced unsafe dangerouslySetInnerHTML with secure analytics
- Fixed TypeScript any types with proper interfaces

### Security
- Added distributed locking to prevent race conditions
- Implemented comprehensive input validation with Zod
- Rate limiting protection against DDoS attacks
- Standardized error responses to prevent information leakage

## [1.0.0] - 2025-01-01

### Added
- Initial release of ExoDrive platform
- Customer booking system with real-time availability
- PayPal payment integration with dispute management
- DocuSeal contract automation
- Admin dashboard for fleet and booking management
- Email notifications via Resend
- Mobile-responsive UI with Next.js 15
- Supabase backend with PostgreSQL and Storage