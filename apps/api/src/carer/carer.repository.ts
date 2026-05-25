import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

@Injectable()
export class CarerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(organizationId: string) {
    return this.prisma.carer.findMany({
      where: this.prisma.whereNotDeleted({ is_active: true, organization_id: organizationId }),
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });
  }

  async upsertById(input: {
    organization_id: string;
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    is_active: boolean;
  }) {
    // `id` is the Cognito sub.
    return this.prisma.carer.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        organization_id: input.organization_id,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone ?? null,
        is_active: input.is_active,
        // hire_date default is now()
      },
      update: {
        organization_id: input.organization_id,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone ?? null,
        is_active: input.is_active,
        deleted_at: null,
      },
    });
  }
}
