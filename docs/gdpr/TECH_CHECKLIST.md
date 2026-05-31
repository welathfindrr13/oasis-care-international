# GDPR Technical Implementation Checklist

## Overview
This document maps the scaffolded GDPR functionality to specific compliance requirements.
For productized secondary-use and monetization controls, see `docs/gdpr/MONETIZATION_PLAYBOOK.md`.

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

## Access Control Status

- **Current production posture**: conservative staff-only gate.
- **Controller guard**: `GdprController` uses `ApiRolesGuard`.
- **Allowed roles**: `admin`, `manager`.
- **Denied roles**: `user`, `carer`, family/external users, unauthenticated callers.
- **Test coverage**: `apps/api/src/gdpr/gdpr.controller.spec.ts` verifies controller guard metadata, role metadata, unauthenticated denial, non-manager/non-admin denial, and authorised manager erasure request path.

Self-service data subject access and proper-representative access are not enabled yet. They require a documented authority/access-basis model before production, especially for family users, attorneys, emergency contacts, and professional viewers.

## Audit Logging
- **Component**: AuditLogInterceptor
- **Status**: Stub implementation (logs to console, no PHI)
- **Next Steps**: Wire to AuditLog table, implement PHI filtering

## Deployment V2 Pre-Live Controls

Deployment V2 is the single-server production foundation. These controls must be complete before real client data is used:

- [ ] **Hosting region**: choose a UK/EU hosting region where possible and document the provider region.
- [ ] **Provider DPA**: complete and retain the hosting provider DPA before processing real care data.
- [ ] **HTTPS**: terminate public traffic through Caddy HTTPS; do not expose web, API, or Postgres directly.
- [ ] **Secrets handling**: keep `deploy/v2/.env` and real secret values out of git; use strong runtime-only secrets.
- [ ] **Backup and restore**: run and document a successful backup and restore rehearsal using Deployment V2 scripts.
- [ ] **Access control**: verify role-based access remains enforced after deployment.
- [ ] **CareBridge boundaries**: smoke-test that family users remain in family-safe surfaces and cannot access raw visits, care notes, medication rows, care-planning internals, evidence packs, staff/admin/reporting data, or staff review queues.
- [ ] **Audit logs**: confirm audit/security logs remain available and are retained for the chosen operational period.
- [ ] **Retention/deletion**: document retention, deletion, legal hold, SAR, and erasure operating procedures.
- [ ] **Incident/breach response**: document first-response owner, notification process, evidence preservation, and escalation path.
- [ ] **DPIA/security review**: complete DPIA and security checklist before using real client data.

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
- [ ] Add self-service/proper-representative authority model before allowing non-staff SAR requests

### 3. Data Erasure
- [ ] Implement cascading deletion logic
- [ ] Handle pseudonymization for legal requirements
- [ ] Create erasure verification reports
- [ ] Implement backup/recovery considerations
- [ ] Require staff review and documented lawful basis before acting on family/proxy erasure requests

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
