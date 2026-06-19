-- CreateEnum
CREATE TYPE "FamilyAccessBasis" AS ENUM ('CLIENT_CONSENT', 'HEALTH_WELFARE_ATTORNEY', 'EMERGENCY_ACCESS', 'BEST_INTERESTS', 'PROFESSIONAL_VIEWER', 'PROVIDER_AUTHORISED');

-- CreateEnum
CREATE TYPE "CareRoomStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CareRoomMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CareRoomRole" AS ENUM ('PRIMARY_CONTACT', 'FAMILY_VIEWER', 'FAMILY_CONTRIBUTOR', 'LEGAL_REPRESENTATIVE', 'EMERGENCY_CONTACT', 'PROFESSIONAL_VIEWER');

-- CreateEnum
CREATE TYPE "AccessGrantScope" AS ENUM ('VIEW_UPDATES', 'VIEW_VISIT_TIMES', 'VIEW_TASK_SUMMARY', 'VIEW_MEDICATION_SUPPORT_STATUS', 'VIEW_WEEKLY_SUMMARIES', 'RAISE_CONCERNS', 'REPLY_TO_CONCERNS', 'SUBMIT_PULSE');

-- CreateEnum
CREATE TYPE "CarebridgeContentStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConcernSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConcernPriority" AS ENUM ('ROUTINE', 'PRIORITY', 'URGENT');

-- CreateEnum
CREATE TYPE "ConcernStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConcernCategory" AS ENUM ('VISIT_DELIVERY', 'COMMUNICATION', 'MEDICATION_SUPPORT', 'WELLBEING_CHANGE', 'SCHEDULING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConcernOutcome" AS ENUM ('RESOLVED', 'NO_ACTION_REQUIRED', 'CARE_PLAN_REVIEW_REQUIRED', 'CALLBACK_COMPLETED', 'ESCALATED_TO_MANAGER', 'ESCALATED_TO_INCIDENT', 'ESCALATED_TO_SAFEGUARDING', 'FAMILY_NOT_SATISFIED');

-- CreateEnum
CREATE TYPE "ConcernEventType" AS ENUM ('RAISED', 'ACKNOWLEDGED', 'ASSIGNED', 'RESPONDED', 'RESOLVED', 'REOPENED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ConcernActorType" AS ENUM ('STAFF', 'FAMILY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FamilyPulseSentiment" AS ENUM ('CONFIDENT', 'UNSURE', 'CONCERNED', 'NEED_CALL');

-- CreateTable
CREATE TABLE "family_contact" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auth_subject" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "relationship" VARCHAR(100),
    "identity_type" VARCHAR(50),
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_room" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "CareRoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_room_membership" (
    "id" TEXT NOT NULL,
    "care_room_id" TEXT NOT NULL,
    "family_contact_id" TEXT NOT NULL,
    "role" "CareRoomRole" NOT NULL,
    "status" "CareRoomMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "access_basis" "FamilyAccessBasis" NOT NULL,
    "consent_record_id" TEXT,
    "review_due_at" TIMESTAMP(3),
    "invited_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "revoked_by_user_id" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_room_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grant" (
    "id" TEXT NOT NULL,
    "care_room_membership_id" TEXT NOT NULL,
    "scope" "AccessGrantScope" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carebridge_policy" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "care_room_id" TEXT,
    "client_id" TEXT,
    "show_carer_name_default" BOOLEAN NOT NULL DEFAULT false,
    "show_visit_times_default" BOOLEAN NOT NULL DEFAULT true,
    "show_task_summary_default" BOOLEAN NOT NULL DEFAULT true,
    "show_medication_support_default" BOOLEAN NOT NULL DEFAULT false,
    "require_approval_for_all_content" BOOLEAN NOT NULL DEFAULT true,
    "family_can_raise_concerns" BOOLEAN NOT NULL DEFAULT true,
    "family_can_reply_to_concerns" BOOLEAN NOT NULL DEFAULT true,
    "family_can_submit_pulse" BOOLEAN NOT NULL DEFAULT true,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ai_drafting_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carebridge_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_visit_story" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "care_room_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "status" "CarebridgeContentStatus" NOT NULL DEFAULT 'DRAFT',
    "draft_title" TEXT NOT NULL,
    "draft_body" TEXT NOT NULL,
    "approved_title" TEXT,
    "approved_body" TEXT,
    "rejection_reason" TEXT,
    "source_refs" JSONB NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_visit_story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concern" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "care_room_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "ConcernSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "ConcernPriority" NOT NULL DEFAULT 'ROUTINE',
    "category" "ConcernCategory" NOT NULL,
    "status" "ConcernStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "ConcernOutcome",
    "raised_by_membership_id" TEXT,
    "raised_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "acknowledgement_due_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "source_refs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concern_message" (
    "id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "actor_type" "ConcernActorType" NOT NULL,
    "actor_label" TEXT,
    "actor_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concern_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concern_event" (
    "id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "event_type" "ConcernEventType" NOT NULL,
    "actor_type" "ConcernActorType" NOT NULL,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concern_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_care_summary" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "care_room_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "CarebridgeContentStatus" NOT NULL DEFAULT 'DRAFT',
    "draft_title" TEXT NOT NULL,
    "draft_body" TEXT NOT NULL,
    "approved_title" TEXT,
    "approved_body" TEXT,
    "rejection_reason" TEXT,
    "source_refs" JSONB NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_care_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_pulse" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "care_room_id" TEXT NOT NULL,
    "care_room_membership_id" TEXT NOT NULL,
    "sentiment" "FamilyPulseSentiment" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_pulse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_contact_auth_subject_key" ON "family_contact"("auth_subject");

-- CreateIndex
CREATE INDEX "family_contact_organization_id_idx" ON "family_contact"("organization_id");

-- CreateIndex
CREATE INDEX "family_contact_email_idx" ON "family_contact"("email");

-- CreateIndex
CREATE INDEX "care_room_organization_id_idx" ON "care_room"("organization_id");

-- CreateIndex
CREATE INDEX "care_room_client_id_idx" ON "care_room"("client_id");

-- CreateIndex
CREATE INDEX "care_room_membership_care_room_id_idx" ON "care_room_membership"("care_room_id");

-- CreateIndex
CREATE INDEX "care_room_membership_family_contact_id_idx" ON "care_room_membership"("family_contact_id");

-- CreateIndex
CREATE INDEX "access_grant_care_room_membership_id_idx" ON "access_grant"("care_room_membership_id");

-- CreateIndex
CREATE INDEX "access_grant_scope_idx" ON "access_grant"("scope");

-- CreateIndex
CREATE INDEX "carebridge_policy_organization_id_idx" ON "carebridge_policy"("organization_id");

-- CreateIndex
CREATE INDEX "carebridge_policy_care_room_id_idx" ON "carebridge_policy"("care_room_id");

-- CreateIndex
CREATE INDEX "carebridge_policy_client_id_idx" ON "carebridge_policy"("client_id");

-- CreateIndex
CREATE INDEX "verified_visit_story_organization_id_idx" ON "verified_visit_story"("organization_id");

-- CreateIndex
CREATE INDEX "verified_visit_story_care_room_id_idx" ON "verified_visit_story"("care_room_id");

-- CreateIndex
CREATE INDEX "verified_visit_story_client_id_idx" ON "verified_visit_story"("client_id");

-- CreateIndex
CREATE INDEX "verified_visit_story_visit_id_idx" ON "verified_visit_story"("visit_id");

-- CreateIndex
CREATE INDEX "verified_visit_story_status_idx" ON "verified_visit_story"("status");

-- CreateIndex
CREATE INDEX "concern_organization_id_idx" ON "concern"("organization_id");

-- CreateIndex
CREATE INDEX "concern_care_room_id_idx" ON "concern"("care_room_id");

-- CreateIndex
CREATE INDEX "concern_client_id_idx" ON "concern"("client_id");

-- CreateIndex
CREATE INDEX "concern_status_idx" ON "concern"("status");

-- CreateIndex
CREATE INDEX "concern_message_concern_id_idx" ON "concern_message"("concern_id");

-- CreateIndex
CREATE INDEX "concern_event_concern_id_idx" ON "concern_event"("concern_id");

-- CreateIndex
CREATE INDEX "weekly_care_summary_organization_id_idx" ON "weekly_care_summary"("organization_id");

-- CreateIndex
CREATE INDEX "weekly_care_summary_care_room_id_idx" ON "weekly_care_summary"("care_room_id");

-- CreateIndex
CREATE INDEX "weekly_care_summary_client_id_idx" ON "weekly_care_summary"("client_id");

-- CreateIndex
CREATE INDEX "family_pulse_organization_id_idx" ON "family_pulse"("organization_id");

-- CreateIndex
CREATE INDEX "family_pulse_care_room_id_idx" ON "family_pulse"("care_room_id");

-- CreateIndex
CREATE INDEX "family_pulse_care_room_membership_id_idx" ON "family_pulse"("care_room_membership_id");

-- AddForeignKey
ALTER TABLE "family_contact" ADD CONSTRAINT "family_contact_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_room" ADD CONSTRAINT "care_room_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_room" ADD CONSTRAINT "care_room_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_room_membership" ADD CONSTRAINT "care_room_membership_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_room_membership" ADD CONSTRAINT "care_room_membership_family_contact_id_fkey" FOREIGN KEY ("family_contact_id") REFERENCES "family_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grant" ADD CONSTRAINT "access_grant_care_room_membership_id_fkey" FOREIGN KEY ("care_room_membership_id") REFERENCES "care_room_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carebridge_policy" ADD CONSTRAINT "carebridge_policy_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carebridge_policy" ADD CONSTRAINT "carebridge_policy_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carebridge_policy" ADD CONSTRAINT "carebridge_policy_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_visit_story" ADD CONSTRAINT "verified_visit_story_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_visit_story" ADD CONSTRAINT "verified_visit_story_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_visit_story" ADD CONSTRAINT "verified_visit_story_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_visit_story" ADD CONSTRAINT "verified_visit_story_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concern" ADD CONSTRAINT "concern_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concern" ADD CONSTRAINT "concern_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concern" ADD CONSTRAINT "concern_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concern_message" ADD CONSTRAINT "concern_message_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concern_event" ADD CONSTRAINT "concern_event_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_care_summary" ADD CONSTRAINT "weekly_care_summary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_care_summary" ADD CONSTRAINT "weekly_care_summary_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_care_summary" ADD CONSTRAINT "weekly_care_summary_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_pulse" ADD CONSTRAINT "family_pulse_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_pulse" ADD CONSTRAINT "family_pulse_care_room_id_fkey" FOREIGN KEY ("care_room_id") REFERENCES "care_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_pulse" ADD CONSTRAINT "family_pulse_care_room_membership_id_fkey" FOREIGN KEY ("care_room_membership_id") REFERENCES "care_room_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
