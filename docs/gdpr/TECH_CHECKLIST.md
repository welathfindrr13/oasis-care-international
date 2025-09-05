# GDPR Technical Implementation Checklist

## Overview
This document maps the scaffolded GDPR functionality to specific compliance requirements.

## Database Tables

### ConsentRecord (`consent_record`)
- **Purpose**: Track user consent for data processing
- **Fields**: user_id, consent_type, purpose, granted, granted_at, withdrawn_at, legal_basis
- **GDPR Mapping**: Article 7 (Consent), Article 13-14 (Information requirements)

### AuditLog (`audit_log`) 
- **Purpose**: Log all data processing activities
- **Fields**: user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, timestamp
- **GDPR Mapping**: Article 30 (Records of processing), Article 5(2) (Accountability)

### RetentionPolicy (`retention_policy`)
- **Purpose**: Define data retention schedules
- **Fields**: data_category, retention_days, legal_basis, description
- **GDPR Mapping**: Article 5(1)(e) (Storage limitation), Article 17 (Right to erasure)

### ErasureQueue (`erasure_queue`)
- **Purpose**: Queue data erasure requests
- **Fields**: user_id, request_type, status, requested_at, scheduled_for, completed_at
- **GDPR Mapping**: Article 17 (Right to erasure)

## API Endpoints

### POST /gdpr/consent
- **Purpose**: Grant or withdraw consent
- **GDPR Mapping**: Article 7 (Consent), Article 21 (Right to object)
- **Returns**: 202 Accepted with request ID
- **Implementation**: ConsentService.grantConsent() / withdrawConsent()

### POST /gdpr/sar
- **Purpose**: Process Subject Access Requests  
- **GDPR Mapping**: Article 15 (Right of access)
- **Returns**: 202 Accepted with request ID and timeline
- **Implementation**: SarService.enqueueSubjectAccessRequest()

### POST /gdpr/erasure
- **Purpose**: Process data erasure requests
- **GDPR Mapping**: Article 17 (Right to erasure)
- **Returns**: 202 Accepted with request ID and timeline
- **Implementation**: ErasureService.enqueueDataErasure()

## Feature Flag
- **Environment Variable**: `GDPR_ENABLED=true`
- **Behavior**: Module only registers routes when flag is enabled
- **Location**: AppModule imports array

## Audit Logging
- **Component**: AuditLogInterceptor
- **Status**: Stub implementation (logs to console, no PHI)
- **Next Steps**: Wire to AuditLog table, implement PHI filtering

## TODO - Implementation Requirements

### 1. Consent Management
- [ ] Implement ConsentService database operations
- [ ] Add consent verification for data processing
- [ ] Create consent UI components

### 2. Subject Access Requests
- [ ] Implement data export across all tables
- [ ] Create structured export format (JSON/XML)
- [ ] Add encryption for sensitive exports
- [ ] Implement delivery mechanism (secure download/email)

### 3. Data Erasure
- [ ] Implement cascading deletion logic
- [ ] Handle pseudonymization for legal requirements
- [ ] Create erasure verification reports
- [ ] Implement backup/recovery considerations

### 4. Audit Logging
- [ ] Wire interceptor to database
- [ ] Implement PHI detection and masking
- [ ] Add audit log retention policies
- [ ] Create audit report generation

### 5. Retention Management
- [ ] Implement automatic data expiry
- [ ] Create retention policy enforcement
- [ ] Add legal hold capabilities
- [ ] Generate retention compliance reports

## Compliance Notes
- Feature-flagged implementation allows gradual rollout
- Stub endpoints return proper HTTP status codes (202 Accepted)
- Database schema includes necessary indexes for performance
- All tables include created_at/updated_at for audit trails
