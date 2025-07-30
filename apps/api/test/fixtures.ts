import { PrismaClient, VisitStatus } from '@prisma/client';
import { TEST_USERS } from './jwt.mock';

export async function createTestFixtures(prisma: PrismaClient) {
  // Clean up existing data
  await cleanDatabase(prisma);

  // Create test carer (matches JWT mock user)
  const carer = await prisma.carer.create({
    data: {
      id: TEST_USERS.carer.sub, // 'carer-123'
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@oasis.uk',
      phone: '07700900123',
      hire_date: new Date('2023-01-01'),
      is_active: true,
    },
  });

  // Create another test carer
  const otherCarer = await prisma.carer.create({
    data: {
      id: TEST_USERS.otherCarer.sub, // 'carer-456'
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@oasis.uk',
      phone: '07700900456',
      hire_date: new Date('2023-06-01'),
      is_active: true,
    },
  });

  // Create test client (matches JWT mock user)
  const client = await prisma.client.create({
    data: {
      id: TEST_USERS.client.sub, // 'client-123'
      full_name: 'Mary Jones',
      address_line1: '123 Test Street',
      address_line2: 'Apartment 4B',
      city: 'London',
      postcode: 'SW1A 1AA',
      date_of_birth: new Date('1950-05-15'),
    },
  });

  // Create another test client
  const otherClient = await prisma.client.create({
    data: {
      id: 'client-456',
      full_name: 'Robert Brown',
      address_line1: '456 Mock Avenue',
      city: 'Manchester',
      postcode: 'M1 1AA',
      date_of_birth: new Date('1945-03-20'),
    },
  });

  // Create some test visits
  const scheduledVisit = await prisma.visit.create({
    data: {
      carer_id: carer.id,
      client_id: client.id,
      scheduled_start: new Date('2024-02-01T09:00:00Z'),
      scheduled_end: new Date('2024-02-01T10:00:00Z'),
      status: VisitStatus.SCHEDULED,
      notes: 'Morning medication and personal care',
      tasks: {
        create: [
          {
            task_name: 'Medication Administration',
            description: 'Give morning medication as prescribed',
          },
          {
            task_name: 'Personal Care',
            description: 'Assist with washing and dressing',
          },
        ],
      },
    },
  });

  const completedVisit = await prisma.visit.create({
    data: {
      carer_id: carer.id,
      client_id: otherClient.id,
      scheduled_start: new Date('2024-01-30T14:00:00Z'),
      scheduled_end: new Date('2024-01-30T15:00:00Z'),
      actual_start: new Date('2024-01-30T14:05:00Z'),
      actual_end: new Date('2024-01-30T14:55:00Z'),
      status: VisitStatus.COMPLETED,
      notes: 'Routine check-in completed successfully',
    },
  });

  return {
    carers: { carer, otherCarer },
    clients: { client, otherClient },
    visits: { scheduledVisit, completedVisit },
  };
}

export async function cleanDatabase(prisma: PrismaClient) {
  // Delete in correct order to respect foreign key constraints
  await prisma.$transaction([
    prisma.visitTask.deleteMany(),
    prisma.visit.deleteMany(),
    prisma.carer.deleteMany(),
    prisma.client.deleteMany(),
  ]);
}
