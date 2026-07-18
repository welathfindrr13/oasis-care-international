import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CarebridgeContentStatus,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  assertMedicationEmarEnabled,
  containsMedicationEmarContent,
  isMedicationEmarEnabled,
} from '../../common/features/medication-emar';

interface SyncVerifiedVisitStoryInput {
  visitId: string;
  organizationId?: string | null;
  actorUserId: string;
}

interface PublishVerifiedVisitStoryInput {
  storyId: string;
  organizationId?: string | null;
  actorUserId: string;
  approvedTitle?: string;
  approvedBody?: string;
}

type SourceRef =
  | { type: 'Visit'; id: string }
  | { type: 'VisitTask'; id: string }
  | { type: 'CareLog'; id: string; category?: string }
  | { type: 'MedicationAdministration'; id: string; visibility: 'STATUS_ONLY' };

@Injectable()
export class CarebridgeFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async syncVerifiedVisitStory(input: SyncVerifiedVisitStoryInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const visit = await this.prisma.visit.findFirst({
      where: this.prisma.whereNotDeleted({
        id: input.visitId,
        organization_id: organizationId,
      }),
      include: {
        carer: true,
        tasks: {
          where: { deleted_at: null },
        },
        care_logs: {
          where: {
            deleted_at: null,
            ...(isMedicationEmarEnabled()
              ? {}
              : {
                  category: { not: 'MEDICATION' },
                  OR: [
                    { notes: null },
                    {
                      NOT: [
                        { notes: { contains: 'medication', mode: 'insensitive' } },
                        { notes: { contains: 'emar', mode: 'insensitive' } },
                      ],
                    },
                  ],
                }),
          },
          orderBy: { created_at: 'desc' },
          take: 3,
        },
        ...(isMedicationEmarEnabled()
          ? {
              medication_administrations: {
                where: { deleted_at: null },
                orderBy: { created_at: 'desc' },
                take: 3,
              },
            }
          : {}),
      },
    }) as any;

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit could not be found for CareBridge synchronisation.',
        HttpStatus.NOT_FOUND,
      );
    }

    const careRoom = await (this.prisma as any).careRoom.findFirst({
      where: {
        organization_id: organizationId,
        client_id: visit.client_id,
      },
      orderBy: { created_at: 'asc' },
    });

    if (!careRoom) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Create a CareBridge room before generating verified visit stories.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const policy = await (this.prisma as any).careBridgePolicy.findFirst({
      where: {
        organization_id: organizationId,
        OR: [{ care_room_id: careRoom.id }, { client_id: visit.client_id }],
      },
      orderBy: [{ care_room_id: 'desc' }, { created_at: 'asc' }],
    });

    const storyTasks = visit.tasks.filter(
      (task: any) => isMedicationEmarEnabled() || !containsMedicationEmarContent(task.task_name),
    );
    const completedTasks = storyTasks.filter((task: any) => task.is_completed);
    const pendingTasks = storyTasks.filter((task: any) => !task.is_completed);
    const showMedicationStatus =
      isMedicationEmarEnabled() &&
      (policy?.show_medication_support_default ?? false);

    const draftTitle =
      completedTasks.length > 0
        ? `Visit completed: ${completedTasks.length} task${completedTasks.length === 1 ? '' : 's'} recorded`
        : 'Visit completed';

    const bodyLines = [
      visit.actual_start
        ? `The visit was recorded as completed at ${visit.actual_start.toISOString()}.`
        : 'The visit was recorded as completed.',
      completedTasks.length > 0
        ? `Completed tasks: ${completedTasks.map((task: any) => task.task_name).join(', ')}.`
        : 'No completed tasks were recorded.',
      pendingTasks.length > 0
        ? `Tasks needing follow-up: ${pendingTasks.map((task: any) => task.task_name).join(', ')}.`
        : null,
      visit.care_logs[0]?.notes ? `Update: ${visit.care_logs[0].notes}` : null,
      showMedicationStatus && visit.medication_administrations?.length > 0
        ? 'Medication support was recorded during this visit.'
        : null,
    ].filter(Boolean);

    const sourceRefs: SourceRef[] = [
      { type: 'Visit', id: visit.id },
      ...storyTasks.map((task: any) => ({ type: 'VisitTask' as const, id: task.id })),
      ...visit.care_logs.map((log: any) => ({
        type: 'CareLog' as const,
        id: log.id,
        category: log.category ?? undefined,
      })),
      ...(showMedicationStatus
        ? (visit.medication_administrations || []).map((medication: any) => ({
            type: 'MedicationAdministration' as const,
            id: medication.id,
            visibility: 'STATUS_ONLY' as const,
          }))
        : []),
    ];

    const existingStory = await (this.prisma as any).verifiedVisitStory.findFirst({
      where: {
        organization_id: organizationId,
        visit_id: visit.id,
      },
    });

    if (existingStory) {
      return (this.prisma as any).verifiedVisitStory.update({
        where: { id: existingStory.id },
        data: {
          draft_title: draftTitle,
          draft_body: bodyLines.join(' '),
          source_refs: sourceRefs,
          status: CarebridgeContentStatus.DRAFT,
          approved_title: null,
          approved_body: null,
          approved_by_id: null,
          approved_at: null,
          published_at: null,
          rejected_at: null,
          rejection_reason: null,
        },
      });
    }

    return (this.prisma as any).verifiedVisitStory.create({
      data: {
        organization_id: organizationId,
        care_room_id: careRoom.id,
        client_id: visit.client_id,
        visit_id: visit.id,
        status: CarebridgeContentStatus.DRAFT,
        draft_title: draftTitle,
        draft_body: bodyLines.join(' '),
        source_refs: sourceRefs,
      },
    });
  }

  async publishVerifiedVisitStory(input: PublishVerifiedVisitStoryInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const story = await (this.prisma as any).verifiedVisitStory.findFirst({
      where: {
        id: input.storyId,
        organization_id: organizationId,
      },
    });

    if (!story) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit story could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (this.isMedicationStory(story)) {
      assertMedicationEmarEnabled();
    }

    const refs = Array.isArray(story.source_refs) ? story.source_refs : [];
    if (refs.length === 0) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit stories must include source references before publication.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return (this.prisma as any).verifiedVisitStory.update({
      where: { id: story.id },
      data: {
        status: CarebridgeContentStatus.PUBLISHED,
        approved_title: input.approvedTitle || story.draft_title,
        approved_body: input.approvedBody || story.draft_body,
        approved_by_id: input.actorUserId,
        approved_at: new Date(),
        published_at: new Date(),
      },
    });
  }

  async listPublishedStoriesForRoom(careRoomId: string) {
    const stories = await (this.prisma as any).verifiedVisitStory.findMany({
      where: {
        care_room_id: careRoomId,
        status: CarebridgeContentStatus.PUBLISHED,
      },
      orderBy: {
        published_at: 'desc',
      },
    });
    return stories.filter((story: any) => !this.isMedicationStory(story));
  }

  private isMedicationStory(story: any): boolean {
    if (isMedicationEmarEnabled()) return false;
    const refs = Array.isArray(story?.source_refs) ? story.source_refs : [];
    const hasMedicationReference = refs.some((ref: any) => {
      const type = String(ref?.type || '').replace(/[^a-z]/gi, '').toLowerCase();
      return (
        type === 'medicationadministration' ||
        String(ref?.category || '').trim().toUpperCase() === 'MEDICATION'
      );
    });
    return (
      hasMedicationReference ||
      containsMedicationEmarContent([
        story?.draft_title,
        story?.draft_body,
        story?.approved_title,
        story?.approved_body,
        story?.family_safe_title,
        story?.family_safe_body,
      ])
    );
  }

  private requireOrganizationId(organizationId?: string | null) {
    const orgId = (organizationId || '').trim();
    if (!orgId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Organization context is required for CareBridge staff actions.',
        HttpStatus.FORBIDDEN,
      );
    }
    return orgId;
  }
}
