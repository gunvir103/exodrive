# Email Inbox Product Requirements Document (PRD)

## Executive Summary

The Email Inbox feature provides administrators with a centralized view of all email communications sent through the ExoDrive platform. While the UI is functional, critical backend integration issues prevent the feature from working properly. This PRD outlines the requirements to complete the implementation and make the inbox fully operational.

## Current State Analysis

### What's Working
- ✅ **UI Component**: `/app/admin/inbox/page.tsx` - Fully functional React component with:
  - Card-based email list display
  - Real-time search functionality
  - Tab-based filtering (All, Delivered, Opened, Clicked, Failed)
  - Pagination (20 emails per page)
  - Status badges and visual indicators
  - Booking association with navigation links
  - Authentication and admin role verification

- ✅ **API Endpoint**: `/app/api/admin/inbox/route.ts` - Basic GET endpoint
- ✅ **Database Table**: `inbox_emails` table exists with proper schema
- ✅ **Partial Webhook**: Resend webhook endpoint exists but has integration issues

### Critical Issues Blocking Functionality

1. **Database Schema Mismatch**
   - Webhook uses incorrect column names that don't exist in the database
   - RLS policies are created before the table exists (migration order issue)
   - No foreign key constraint on booking_id

2. **Navigation Missing**
   - Inbox is not accessible from admin sidebar
   - Users must know the direct URL `/admin/inbox`

3. **Webhook Integration Broken**
   - Column name mismatches will cause all email logging to fail
   - Events won't be recorded in the inbox_emails table

## Requirements

### Phase 1: Critical Fixes (Must Have - Feature Won't Work Without These)

#### 1.1 Database Schema Alignment

**Problem**: The webhook handler expects different column names than what exists in the database.

**Requirements**:
- Fix column name mapping in webhook handler:
  - `resend_id` → `resend_email_id`
  - `from_email` → `sender_email`
  - `to_email` → `recipient_email`
  - `status` → use `last_event_type`
  - `email_type` → store in `tags` JSONB field
  - `metadata` → store in `raw_payload` JSONB field

**Acceptance Criteria**:
- Webhook successfully inserts email records into inbox_emails table
- All Resend events are properly logged
- No database errors in webhook logs

#### 1.2 Fix Migration Order

**Problem**: RLS policies for inbox_emails are created before the table exists.

**Requirements**:
- Create new migration to properly set up RLS policies
- Add foreign key constraint for booking_id
- Ensure proper indexes for performance

**Migration SQL**:
```sql
-- Add RLS policies
ALTER TABLE inbox_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view all emails" ON inbox_emails
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Add foreign key constraint
ALTER TABLE inbox_emails 
ADD CONSTRAINT fk_inbox_emails_booking 
FOREIGN KEY (booking_id) 
REFERENCES bookings(id) 
ON DELETE SET NULL;

-- Add performance indexes
CREATE INDEX idx_inbox_emails_recipient ON inbox_emails(recipient_email);
CREATE INDEX idx_inbox_emails_sent_at ON inbox_emails(sent_at);
CREATE INDEX idx_inbox_emails_booking_id ON inbox_emails(booking_id);
CREATE INDEX idx_inbox_emails_last_event ON inbox_emails(last_event_type);
```

**Acceptance Criteria**:
- RLS policies properly restrict access to admin users only
- Foreign key constraint prevents invalid booking references
- Queries perform efficiently with proper indexes

#### 1.3 Add Navigation Link

**Problem**: Inbox is inaccessible from the admin dashboard.

**Requirements**:
- Import `Inbox` icon from lucide-react in `/app/admin/layout.tsx`
- Add navigation item after "Bookings" and before "Settings"
- Include pathname check for active state highlighting

**Code Changes**:
```tsx
// Add to imports
import { Inbox } from 'lucide-react';

// Add to navigation items (after Bookings)
{
  label: 'Inbox',
  icon: Inbox,
  href: '/admin/inbox',
}

// Update isActive check to include
pathname.startsWith('/admin/inbox')
```

**Acceptance Criteria**:
- Inbox link appears in admin sidebar
- Link is properly highlighted when active
- Clicking navigates to /admin/inbox

### Phase 2: Core Feature Completion

#### 2.1 Email Detail View

**Requirements**:
- Add modal or side panel to view full email details
- Display complete email event timeline
- Show raw email content (HTML/Text)
- Display full Resend payload data
- Link to associated booking with customer details

**UI Components Needed**:
- Email detail modal/drawer component
- Timeline component for email events
- HTML email preview with iframe sandboxing
- JSON viewer for raw payload

**Acceptance Criteria**:
- Clicking an email opens detailed view
- All email data is accessible
- Associated booking information is displayed
- Modal can be closed with ESC or click outside

#### 2.2 Enhanced Filtering

**Requirements**:
- Add date range picker for filtering emails by time period
- Filter by email type (booking confirmation, contact form, etc.)
- Filter by sender email
- Allow combining multiple filters
- Persist filter state in URL parameters

**UI Components Needed**:
- Date range picker component
- Multi-select dropdown for email types
- Sender email dropdown with search
- Clear filters button

**Acceptance Criteria**:
- All filters work independently and in combination
- Filter state persists on page refresh
- Results update immediately on filter change
- "Clear filters" resets all selections

#### 2.3 Bulk Actions

**Requirements**:
- Add checkbox selection for multiple emails
- Implement "Mark as Read/Unread" functionality
- Add bulk delete with confirmation
- Export selected emails to CSV

**UI Components Needed**:
- Checkbox column in email list
- Bulk action toolbar (appears when items selected)
- Confirmation dialog for destructive actions
- CSV export utility

**Database Changes**:
- Add `is_read` boolean column to track read status
- Add `deleted_at` timestamp for soft deletes

**Acceptance Criteria**:
- Can select all/none with header checkbox
- Bulk actions only appear when items selected
- Destructive actions require confirmation
- CSV export includes all email data

## Technical Implementation Details

### API Endpoints Required

1. **GET /api/admin/inbox** (Existing - Needs Enhancement)
   - Add query parameters for all filters
   - Add sorting options
   - Return read/unread counts

2. **GET /api/admin/inbox/[emailId]**
   - Return full email details including all events
   - Include associated booking data

3. **PATCH /api/admin/inbox/[emailId]**
   - Update read status
   - Soft delete functionality

4. **POST /api/admin/inbox/bulk**
   - Handle bulk operations (mark read, delete)
   - Return success/failure counts

5. **POST /api/admin/inbox/export**
   - Generate CSV export
   - Support filtered exports

### Database Schema Updates

```sql
-- Add missing columns
ALTER TABLE inbox_emails ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE inbox_emails ADD COLUMN deleted_at TIMESTAMPTZ;

-- Update indexes
CREATE INDEX idx_inbox_emails_is_read ON inbox_emails(is_read);
CREATE INDEX idx_inbox_emails_deleted_at ON inbox_emails(deleted_at);
```

### Webhook Handler Updates

Update `/app/api/webhooks/resend/route.ts` to properly map fields:

```typescript
const emailData = {
  resend_email_id: event.data.email_id,
  sender_email: event.data.from,
  recipient_email: event.data.to[0], // Handle multiple recipients
  subject: event.data.subject,
  sent_at: event.data.created_at,
  last_event_type: event.type,
  last_event_at: new Date(),
  tags: {
    email_type: determineEmailType(event.data),
    // other tags
  },
  raw_payload: event.data,
  // Map other fields appropriately
};
```

## Success Metrics

1. **Functional Metrics**:
   - 100% of Resend events successfully logged
   - Zero database errors in webhook processing
   - All emails accessible through admin UI

2. **Performance Metrics**:
   - Email list loads in < 500ms
   - Search/filter operations complete in < 200ms
   - Export handles 10,000+ emails without timeout

3. **User Experience Metrics**:
   - Admins can find any email within 3 clicks
   - All email data is accessible and actionable
   - Bulk operations save significant time

## Testing Requirements

1. **Unit Tests**:
   - Webhook data transformation logic
   - Filter combination logic
   - Export data formatting

2. **Integration Tests**:
   - Webhook → Database flow
   - API endpoints with various filters
   - Bulk operations

3. **E2E Tests**:
   - Complete email tracking flow
   - Admin navigation and access
   - Filter and search functionality

## Rollout Plan

1. **Development Phase**:
   - Fix critical database issues first
   - Add navigation link
   - Test webhook integration thoroughly

2. **Testing Phase**:
   - Manual testing of all scenarios
   - Load testing with high email volumes
   - Security testing for admin access

3. **Deployment**:
   - Deploy database migrations first
   - Deploy backend changes
   - Deploy frontend updates
   - Monitor webhook logs for errors

## Appendix: Example Email Types

The system should recognize and categorize these email types:
- `booking_confirmation` - Initial booking confirmation
- `booking_reminder` - Pre-trip reminders
- `booking_modified` - Booking change notifications
- `booking_cancelled` - Cancellation confirmations
- `contact_form` - Customer inquiries
- `system_notification` - System alerts and updates