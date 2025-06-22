# Email Inbox Feature Completion - Product Requirements Document

## Executive Summary

The Email Inbox feature provides administrators with centralized email communication tracking. While the UI is functional, critical backend integration issues prevent proper operation. This PRD outlines the requirements to fix these issues and make the inbox fully operational.

## Current State Analysis

### Working Components
- **UI Component**: Fully functional React component with search, filtering, and pagination
- **API Endpoint**: Basic GET endpoint exists but lacks proper integration
- **Database Table**: `inbox_emails` table exists with correct schema
- **Webhook Endpoint**: Resend webhook exists but has critical mapping issues

### Critical Issues

1. **Database Integration Failures**
   - Webhook uses incorrect column names preventing email logging
   - RLS policies created before table exists (migration order issue)
   - Missing foreign key constraint on booking_id

2. **Navigation Accessibility**
   - Inbox not accessible from admin sidebar
   - Users must know direct URL `/admin/inbox`

3. **Data Flow Broken**
   - Column name mismatches cause webhook failures
   - Email events not being recorded in database

## Technical Requirements

### Phase 1: Critical Database Fixes

#### Column Mapping Corrections
The webhook handler must map Resend data to correct database columns:

**Required Mappings:**
- `email_id` → `resend_email_id`
- `from` → `sender_email`
- `to[0]` → `recipient_email`
- Event type → `last_event_type`
- Email type → Store in `tags` JSONB field
- Full event data → `raw_payload` JSONB field

#### Migration Requirements
```
supabase/migrations/
├── fix_inbox_emails_rls.sql     # New migration for RLS policies
├── add_inbox_emails_fk.sql      # Foreign key constraint
└── add_inbox_emails_indexes.sql # Performance indexes
```

**Migration Contents:**
1. Enable RLS with proper admin-only policies
2. Add foreign key to bookings table with ON DELETE SET NULL
3. Create indexes on recipient_email, sent_at, booking_id, last_event_type

#### Best Practices
- Test migrations in staging environment first
- Include rollback procedures
- Verify existing data integrity
- Document migration dependencies

### Phase 2: Admin Navigation Integration

#### Requirements
1. Import Inbox icon from lucide-react
2. Add navigation item between Bookings and Settings
3. Include active state highlighting
4. Maintain consistent styling with other nav items

#### Navigation Structure
```
Dashboard
Bookings
Inbox (new)     ← Add here
Settings
```

### Phase 3: Webhook Integration Repair

#### Implementation Requirements
1. Update column mappings in webhook handler
2. Add proper error handling and logging
3. Implement retry logic for transient failures
4. Validate webhook signatures

#### Data Processing Flow
1. Receive Resend webhook event
2. Validate signature and payload
3. Transform data to match database schema
4. Insert/update inbox_emails record
5. Log success/failure for monitoring

#### Best Practices
- Idempotent webhook processing
- Comprehensive error logging
- Graceful failure handling
- Event type validation

## Dependencies

### External Dependencies
- Existing Resend webhook configuration
- Supabase database access
- Admin authentication system

### Internal Dependencies
```
app/
├── api/webhooks/resend/    # Webhook handler
├── admin/inbox/            # UI component
└── admin/layout.tsx        # Navigation layout

lib/
└── supabase/              # Database client
```

### Environment Variables
All required variables are already configured:
- RESEND_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- Database connection settings

## Implementation Approach

### Phase 1: Database Fixes
1. Create and test migration scripts
2. Fix webhook column mappings
3. Deploy migrations to production
4. Verify webhook data flow

### Phase 2: Navigation
1. Update admin layout component
2. Add inbox icon import
3. Insert navigation link
4. Test navigation flow

### Phase 3: Enhanced Features (Future)
- Email detail view modal
- Advanced filtering options
- Bulk operations support
- CSV export functionality

## Success Metrics

### Functional Metrics
- 100% of Resend events logged successfully
- Zero database errors in webhook processing
- All emails accessible through admin UI

### Performance Metrics
- Email list loads in < 500ms
- Search operations complete in < 200ms
- Webhook processing < 100ms

### User Experience
- Single-click access from admin sidebar
- Intuitive email management interface
- Reliable email audit trail

## Testing Requirements

### Unit Tests
- Webhook data transformation logic
- Column mapping validation
- Error handling scenarios

### Integration Tests
- End-to-end webhook flow
- Database constraint validation
- Navigation accessibility

### Manual Testing
- Verify all email types display correctly
- Test search and filtering
- Confirm booking associations work

## Security Considerations

### Access Control
- Admin-only access via RLS policies
- Secure webhook endpoint
- No PII exposure in logs

### Data Integrity
- Foreign key constraints
- Input validation
- Webhook signature verification

## Monitoring & Maintenance

### Key Metrics
- Webhook success/failure rates
- Email delivery statistics
- Database query performance

### Alerts
- Webhook processing failures
- High error rates
- Database connection issues

## Future Enhancements

### Planned Features
1. **Email Analytics Dashboard**
   - Delivery rates by type
   - Engagement metrics
   - Failure analysis

2. **Advanced Management**
   - Resend failed emails
   - Template preview
   - Batch operations

3. **Integration Expansion**
   - Customer email history view
   - Automated follow-ups
   - Campaign tracking

## Rollout Strategy

### Deployment Steps
1. Deploy database migrations
2. Update webhook handler
3. Deploy navigation changes
4. Monitor webhook logs
5. Verify data flow

### Rollback Plan
- Revert webhook handler if issues
- Navigation changes are non-breaking
- Database migrations include rollback

## Documentation Requirements

### Technical Documentation
- Webhook integration guide
- Database schema reference
- Troubleshooting procedures

### User Documentation
- Admin inbox usage guide
- Email status explanations
- Search and filter instructions