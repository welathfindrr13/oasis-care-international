-- AlterEnum for MedicationAuditAction - Add AI summary audit actions
ALTER TYPE "MedicationAuditAction" ADD VALUE 'AI_SUMMARY_GENERATED';
ALTER TYPE "MedicationAuditAction" ADD VALUE 'AI_SUMMARY_APPROVED';  
ALTER TYPE "MedicationAuditAction" ADD VALUE 'AI_SUMMARY_REJECTED';
