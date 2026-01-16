import { Injectable } from '@nestjs/common';
import { PrismaService, Client, Prisma } from '@oasis/db';

@Injectable()
export class ClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Client | null> {
    return this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({ id }),
    });
  }

  async findMany(args: {
    where?: Prisma.ClientWhereInput;
    skip?: number;
    take?: number;
  }): Promise<{ items: Client[]; total: number }> {
    const where = this.prisma.whereNotDeleted(args.where);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { full_name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async create(data: {
    full_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    postcode: string;
  }): Promise<Client> {
    return this.prisma.client.create({
      data,
    });
  }
}
