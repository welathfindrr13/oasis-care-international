import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, CarePlan, CarePlanVersion } from '@oasis/db';

@Injectable()
export class CarePlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClientById(clientId: string) {
    return this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({ id: clientId }),
    });
  }

  async findByClientId(clientId: string): Promise<(CarePlan & {
    active_version: CarePlanVersion | null;
    draft_version: CarePlanVersion | null;
  }) | null> {
    return this.prisma.carePlan.findFirst({
      where: this.prisma.whereNotDeleted({ client_id: clientId }),
      include: {
        active_version: true,
        draft_version: true,
      },
    });
  }

  async findById(carePlanId: string): Promise<(CarePlan & {
    active_version: CarePlanVersion | null;
    draft_version: CarePlanVersion | null;
  }) | null> {
    return this.prisma.carePlan.findFirst({
      where: this.prisma.whereNotDeleted({ id: carePlanId }),
      include: {
        active_version: true,
        draft_version: true,
      },
    });
  }

  async findPublishedHistoryByClientId(clientId: string): Promise<CarePlanVersion[]> {
    const carePlan = await this.prisma.carePlan.findFirst({
      where: this.prisma.whereNotDeleted({ client_id: clientId }),
      select: { id: true },
    });

    if (!carePlan) {
      return [];
    }

    return this.prisma.carePlanVersion.findMany({
      where: this.prisma.whereNotDeleted({
        care_plan_id: carePlan.id,
        status: { in: ['ACTIVE', 'SUPERSEDED'] },
      }),
      orderBy: [
        { version_number: 'desc' },
        { created_at: 'desc' },
      ],
    });
  }

  async createCarePlan(clientId: string): Promise<CarePlan> {
    return this.prisma.carePlan.create({
      data: {
        client: { connect: { id: clientId } },
      },
    });
  }

  async getNextVersionNumber(carePlanId: string): Promise<number> {
    const latestVersion = await this.prisma.carePlanVersion.findFirst({
      where: this.prisma.whereNotDeleted({ care_plan_id: carePlanId }),
      orderBy: { version_number: 'desc' },
      select: { version_number: true },
    });

    return (latestVersion?.version_number ?? 0) + 1;
  }

  async createVersion(data: Prisma.CarePlanVersionUncheckedCreateInput): Promise<CarePlanVersion> {
    return this.prisma.carePlanVersion.create({ data });
  }

  async updateVersion(
    id: string,
    data: Prisma.CarePlanVersionUncheckedUpdateInput
  ): Promise<CarePlanVersion> {
    return this.prisma.carePlanVersion.update({
      where: { id },
      data,
    });
  }

  async updateCarePlan(
    id: string,
    data: Prisma.CarePlanUncheckedUpdateInput
  ): Promise<CarePlan> {
    return this.prisma.carePlan.update({
      where: { id },
      data,
    });
  }

  async runPublishTransaction(params: {
    carePlanId: string;
    draftVersionId: string;
    previousActiveVersionId?: string | null;
    approvedBy: string;
    approvedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (params.previousActiveVersionId) {
        await tx.carePlanVersion.update({
          where: { id: params.previousActiveVersionId },
          data: {
            status: 'SUPERSEDED',
          },
        });
      }

      const publishedDraft = await tx.carePlanVersion.update({
        where: { id: params.draftVersionId },
        data: {
          status: 'ACTIVE',
          approved_by: params.approvedBy,
          approved_at: params.approvedAt,
        },
      });

      await tx.carePlan.update({
        where: { id: params.carePlanId },
        data: {
          active_version_id: params.draftVersionId,
          draft_version_id: null,
        },
      });

      return publishedDraft;
    });
  }
}
