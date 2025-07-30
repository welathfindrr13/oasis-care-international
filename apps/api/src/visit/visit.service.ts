import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { VisitRepository } from './visit.repository';
import { CreateVisitInput } from './dto/create-visit.input';
import { UpdateVisitInput } from './dto/update-visit.input';
import { VisitFilterArgs } from './dto/visit-filter.args';
import { Visit, VisitTask, VisitStatus } from '@oasis/db';
import { ClsService } from 'nestjs-cls';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class VisitService {
  private readonly logger = new Logger(VisitService.name);

  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly cls: ClsService,
  ) {}

  async createVisit(
    data: CreateVisitInput,
    userId: string,
    userRole: string
  ): Promise<Visit> {
    const requestId = this.cls.get('requestId');
    this.logger.log(`Creating visit for carer ${data.carerId}`, { requestId });

    // Check for overlapping visits
    const overlappingVisits = await this.visitRepository.findOverlappingVisits(
      data.carerId,
      new Date(data.scheduledStart),
      new Date(data.scheduledEnd)
    );

    if (overlappingVisits.length > 0) {
      this.logger.warn(
        `Overlapping visit found for carer ${data.carerId}`,
        { requestId, overlappingVisits: overlappingVisits.map(v => v.id) }
      );
      throw new BaseHttpException(
        ErrorCode.VISIT_OVERLAP,
        'Carer already has a visit scheduled during this time period',
        HttpStatus.CONFLICT
      );
    }

    const visit = await this.visitRepository.create({
      carer: { connect: { id: data.carerId } },
      client: { connect: { id: data.clientId } },
      scheduled_start: new Date(data.scheduledStart),
      scheduled_end: new Date(data.scheduledEnd),
      status: data.status || VisitStatus.SCHEDULED,
      notes: data.notes,
    });

    // Create initial tasks if provided
    if (data.tasks && data.tasks.length > 0) {
      for (const task of data.tasks) {
        await this.visitRepository.createTask(visit.id, {
          task_name: task.taskName,
          description: task.description,
        });
      }

      // Refetch visit with tasks
      return this.visitRepository.findById(visit.id) as Promise<Visit>;
    }

    this.logger.log(`Visit ${visit.id} created successfully`, { requestId });
    return visit;
  }

  async updateVisit(
    id: string,
    data: UpdateVisitInput,
    userId: string,
    userRole: string
  ): Promise<Visit> {
    const requestId = this.cls.get('requestId');
    const visit = await this.visitRepository.findById(id);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Check permissions
    this.checkVisitAccess(visit, userId, userRole, 'update');

    // If updating schedule, check for overlaps
    if (data.scheduledStart || data.scheduledEnd) {
      const scheduledStart = data.scheduledStart 
        ? new Date(data.scheduledStart) 
        : visit.scheduled_start;
      const scheduledEnd = data.scheduledEnd 
        ? new Date(data.scheduledEnd) 
        : visit.scheduled_end;

      const overlappingVisits = await this.visitRepository.findOverlappingVisits(
        visit.carer_id,
        scheduledStart,
        scheduledEnd,
        visit.id
      );

      if (overlappingVisits.length > 0) {
        throw new BaseHttpException(
          ErrorCode.VISIT_OVERLAP,
          'Carer already has a visit scheduled during this time period',
          HttpStatus.CONFLICT
        );
      }
    }

    const updateData: any = {};
    if (data.scheduledStart) updateData.scheduled_start = new Date(data.scheduledStart);
    if (data.scheduledEnd) updateData.scheduled_end = new Date(data.scheduledEnd);
    if (data.actualStart) updateData.actual_start = new Date(data.actualStart);
    if (data.actualEnd) updateData.actual_end = new Date(data.actualEnd);
    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    this.logger.log(`Updating visit ${id}`, { requestId, updateData });
    return this.visitRepository.update(id, updateData);
  }

  async findVisitById(
    id: string,
    userId: string,
    userRole: string
  ): Promise<Visit> {
    const visit = await this.visitRepository.findById(id);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit not found',
        HttpStatus.NOT_FOUND
      );
    }

    this.checkVisitAccess(visit, userId, userRole, 'read');
    return visit;
  }

  async findVisits(
    filter: VisitFilterArgs,
    userId: string,
    userRole: string
  ): Promise<{ items: Visit[]; total: number }> {
    const requestId = this.cls.get('requestId');
    const where: any = {};

    // Apply role-based filtering
    if (userRole === 'carer') {
      where.carer_id = userId;
    } else if (userRole === 'client') {
      where.client_id = userId;
    }

    // Apply additional filters
    if (filter.carerId) where.carer_id = filter.carerId;
    if (filter.clientId) where.client_id = filter.clientId;
    if (filter.status) where.status = filter.status;
    
    if (filter.scheduledStartFrom || filter.scheduledStartTo) {
      where.scheduled_start = {};
      if (filter.scheduledStartFrom) {
        where.scheduled_start.gte = new Date(filter.scheduledStartFrom);
      }
      if (filter.scheduledStartTo) {
        where.scheduled_start.lte = new Date(filter.scheduledStartTo);
      }
    }

    this.logger.log(`Finding visits with filter`, { requestId, where });

    return this.visitRepository.findMany({
      where,
      skip: filter.skip,
      take: filter.take || 20,
      orderBy: { scheduled_start: 'desc' },
    });
  }

  async deleteVisit(
    id: string,
    userId: string,
    userRole: string
  ): Promise<Visit> {
    const visit = await this.visitRepository.findById(id);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit not found',
        HttpStatus.NOT_FOUND
      );
    }

    this.checkVisitAccess(visit, userId, userRole, 'delete');

    const requestId = this.cls.get('requestId');
    this.logger.log(`Soft deleting visit ${id}`, { requestId });

    return this.visitRepository.delete(id);
  }

  async completeTask(
    taskId: string,
    notes: string | undefined,
    userId: string,
    userRole: string
  ): Promise<VisitTask> {
    const requestId = this.cls.get('requestId');
    const task = await this.visitRepository.findTaskById(taskId);

    if (!task) {
      throw new BaseHttpException(
        ErrorCode.TASK_NOT_FOUND,
        'Task not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Get the visit to check permissions
    const visit = await this.visitRepository.findById(task.visit_id);
    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit not found',
        HttpStatus.NOT_FOUND
      );
    }

    this.checkVisitAccess(visit, userId, userRole, 'update');

    this.logger.log(`Completing task ${taskId}`, { requestId });

    return this.visitRepository.updateTask(taskId, {
      is_completed: true,
      completed_at: new Date(),
      notes: notes || task.notes,
    });
  }

  private checkVisitAccess(
    visit: Visit & { carer?: any; client?: any },
    userId: string,
    userRole: string,
    action: 'read' | 'update' | 'delete'
  ): void {
    if (userRole === 'admin') {
      return; // Admin has full access
    }

    if (userRole === 'carer') {
      if (visit.carer_id !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'You can only access your own visits',
          HttpStatus.FORBIDDEN
        );
      }
    } else if (userRole === 'client') {
      if (visit.client_id !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'You can only view your own visits',
          HttpStatus.FORBIDDEN
        );
      }
      if (action !== 'read') {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_READ_ONLY,
          'Clients have read-only access to visits',
          HttpStatus.FORBIDDEN
        );
      }
    } else {
      throw new BaseHttpException(
        ErrorCode.INVALID_ROLE,
        'Invalid user role',
        HttpStatus.FORBIDDEN
      );
    }
  }
}
