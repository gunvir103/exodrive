# Security Policy

## Reporting Security Vulnerabilities

Please report security vulnerabilities to security@exodrive.com. Do not create public issues for security problems.

## Security Best Practices

### API Security
- **Rate Limiting**: 60-300 requests/minute based on user type
- **Input Validation**: Zod schemas validate all API inputs
- **SQL Injection Prevention**: All queries use parameterized statements via Supabase
- **XSS Protection**: User input sanitized, no dangerouslySetInnerHTML usage
- **CSRF Protection**: State parameter validation in OAuth flows

### Authentication & Authorization
- **Admin Authentication**: Supabase Auth with secure session management
- **Customer Access**: Secure token generation with expiry
- **Row Level Security**: RLS policies on all database tables
- **Session Management**: 15-minute sliding window expiry
- **Password Policy**: Enforced via Supabase Auth rules

### Data Protection
- **PII Handling**: No personal data in cache keys or logs
- **Encryption**: TLS for all connections, encrypted at rest via Supabase
- **Secure Storage**: Sensitive data in environment variables
- **Payment Security**: PCI compliance via PayPal integration
- **File Uploads**: Type validation, size limits, content verification

### Payment Security
- **Server-Side Pricing**: All rental prices calculated in database functions
- **Price Validation**: Client-submitted prices validated against server calculations
- **Manipulation Detection**: Monitors and logs price tampering attempts
- **Automatic Capture**: Reduces manual intervention and potential errors
- **Capture Rules**: Configurable business rules for payment timing
- **Audit Trail**: Complete logging of all pricing and payment events

### Infrastructure Security
- **Redis Security**: Password protection, TLS connections
- **Database Security**: SSL connections, connection pooling limits
- **Environment Variables**: Never committed, loaded via .env.local
- **Dependency Management**: Regular updates, vulnerability scanning
- **Error Handling**: Generic messages to users, detailed logs server-side

### Webhook Security
- **Signature Verification**: All webhooks verify signatures
- **Replay Protection**: Timestamp validation
- **Rate Limiting**: Webhook endpoints protected
- **Fail Closed**: Invalid signatures always rejected in production

### Monitoring & Incident Response
- **Request Tracing**: X-Trace-Id header on all requests
- **Security Logging**: Authentication failures, rate limit violations
- **Price Manipulation Monitoring**: Alerts on validation failures
- **Payment Capture Monitoring**: Track success rates and failures
- **Alerting**: Automated alerts for security events
- **Audit Trail**: All admin actions and pricing decisions logged
- **Incident Response**: 24-hour response time for critical issues

### Security Monitoring Metrics
- **Price Validation Failures**: Potential attack indicators
- **Repeated Manipulation Attempts**: Pattern detection for bad actors
- **Payment Capture Success Rate**: Operational health indicator
- **Authorization Expiry**: Prevent revenue loss from expired holds

## Security Headers

The application implements the following security headers:
- Content-Security-Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: restrictive

## Server-Side Security Implementation

### Price Calculation Security
1. **Database Functions**: All pricing logic in PostgreSQL functions
2. **Input Validation**: Car ID, dates validated before calculation
3. **Business Rules**: Minimum rental days, discounts applied server-side
4. **Audit Logging**: Every calculation logged with timestamp and parameters

### Price Validation Flow
```
Client Request → API Endpoint → Database Price Calculation
                      ↓
              Validate Client Price
                      ↓
              Log Any Mismatch → Alert if Suspicious
                      ↓
              Proceed with Server Price Only
```

### Automatic Payment Capture Security
1. **Scheduled Processing**: Cron job with secret authentication
2. **Rule-Based Logic**: Configurable capture timing
3. **Retry Mechanism**: Handles transient failures
4. **Status Tracking**: Complete audit trail of capture attempts

## Regular Security Activities

1. **Daily**: Monitor price validation failures
2. **Weekly**: Dependency vulnerability scanning
3. **Monthly**: Security audit of new features
4. **Quarterly**: Penetration testing
5. **Ongoing**: Security training for developers

## Compliance

- GDPR compliant data handling
- CCPA privacy rights supported
- PCI DSS compliance via PayPal
- SOC 2 Type II in progress