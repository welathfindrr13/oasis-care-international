import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo database...');

  // Clear existing data
  await prisma.visitTask.deleteMany();
  await prisma.medicationAdministration.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.carer.deleteMany();
  await prisma.client.deleteMany();
  await prisma.organization.deleteMany();

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Oasis Care Demo',
      ai_summary_enabled: true,
    },
  });

  // Create demo medications
  const medications = await Promise.all([
    prisma.medication.create({
      data: { name: 'Paracetamol', dosage: '500', unit: 'mg', instructions: 'Take with food' },
    }),
    prisma.medication.create({
      data: { name: 'Lisinopril', dosage: '10', unit: 'mg', instructions: 'Take in morning' },
    }),
    prisma.medication.create({
      data: { name: 'Metformin', dosage: '500', unit: 'mg', instructions: 'Take with meals' },
    }),
  ]);

  // Create demo carers
  const carers = await Promise.all([
    prisma.carer.create({
      data: {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'carer.sarah@demo.local',
        phone: '+44 20 7946 0958',
        hire_date: new Date('2023-01-15'),
      },
    }),
    prisma.carer.create({
      data: {
        first_name: 'Mike',
        last_name: 'Thompson',
        email: 'carer.mike@demo.local',
        phone: '+44 20 7946 0959',
        hire_date: new Date('2023-03-22'),
      },
    }),
    prisma.carer.create({
      data: {
        first_name: 'Emma',
        last_name: 'Wilson',
        email: 'carer.emma@demo.local',
        phone: '+44 20 7946 0960',
        hire_date: new Date('2023-06-10'),
      },
    }),
    prisma.carer.create({
      data: {
        first_name: 'Joe',
        last_name: 'Davies',
        email: 'carer.joe@demo.local',
        phone: '+44 20 7946 0961',
        hire_date: new Date('2023-08-05'),
      },
    }),
  ]);

  // Create demo clients
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        full_name: 'Margaret Thompson',
        address_line1: '42 Baker Street',
        city: 'London',
        postcode: 'NW1 6XE',
        date_of_birth: new Date('1948-03-15'),
        organization_id: org.id,
      },
    }),
    prisma.client.create({
      data: {
        full_name: 'Robert Smith',
        address_line1: '15 Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
        date_of_birth: new Date('1952-07-22'),
        organization_id: org.id,
      },
    }),
    prisma.client.create({
      data: {
        full_name: 'Emily Davis',
        address_line1: '123 Oxford Street',
        city: 'London',
        postcode: 'W1D 2HX',
        date_of_birth: new Date('1945-11-08'),
        organization_id: org.id,
      },
    }),
    prisma.client.create({
      data: {
        full_name: 'John Williams',
        address_line1: '88 Regent Street',
        city: 'London',
        postcode: 'W1B 5TF',
        date_of_birth: new Date('1950-12-03'),
        organization_id: org.id,
      },
    }),
    prisma.client.create({
      data: {
        full_name: 'Mary Brown',
        address_line1: '56 King\'s Road',
        city: 'London',
        postcode: 'SW3 4ND',
        date_of_birth: new Date('1943-05-18'),
        organization_id: org.id,
      },
    }),
  ]);

  // Create prescriptions
  const prescriptions = await Promise.all([
    prisma.prescription.create({
      data: {
        client_id: clients[0].id,
        medication_id: medications[0].id,
        start_date: new Date('2025-08-01'),
        frequency_per_day: 2,
        frequency_interval_hours: 12,
        administration_times: ['08:00', '20:00'],
      },
    }),
    prisma.prescription.create({
      data: {
        client_id: clients[1].id,
        medication_id: medications[1].id,
        start_date: new Date('2025-08-01'),
        frequency_per_day: 1,
        frequency_interval_hours: 24,
        administration_times: ['08:00'],
      },
    }),
  ]);

  // Generate today and tomorrow visit times
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const getTodayTime = (hour: number, minute: number = 0) => {
    const time = new Date(today);
    time.setHours(hour, minute, 0, 0);
    return time;
  };
  
  const getTomorrowTime = (hour: number, minute: number = 0) => {
    const time = new Date(tomorrow);
    time.setHours(hour, minute, 0, 0);
    return time;
  };

  // Create visits - 6 today (2 finished, 4 upcoming), 6 tomorrow
  const visits = await Promise.all([
    // Today - COMPLETED
    prisma.visit.create({
      data: {
        carer_id: carers[0].id,
        client_id: clients[0].id,
        scheduled_start: getTodayTime(9, 0),
        scheduled_end: getTodayTime(10, 0),
        actual_start: getTodayTime(9, 5),
        actual_end: getTodayTime(10, 10),
        status: 'COMPLETED',
        notes: 'Client was in good spirits. Medication administered on time.',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[1].id,
        client_id: clients[1].id,
        scheduled_start: getTodayTime(11, 0),
        scheduled_end: getTodayTime(12, 0),
        actual_start: getTodayTime(11, 0),
        actual_end: getTodayTime(11, 45),
        status: 'COMPLETED',
        notes: 'Prepared lunch and assisted with mobility exercises.',
      },
    }),
    // Today - UPCOMING
    prisma.visit.create({
      data: {
        carer_id: carers[2].id,
        client_id: clients[2].id,
        scheduled_start: getTodayTime(14, 0),
        scheduled_end: getTodayTime(15, 0),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[0].id,
        client_id: clients[3].id,
        scheduled_start: getTodayTime(15, 30),
        scheduled_end: getTodayTime(16, 30),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[3].id,
        client_id: clients[4].id,
        scheduled_start: getTodayTime(17, 0),
        scheduled_end: getTodayTime(18, 0),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[1].id,
        client_id: clients[0].id,
        scheduled_start: getTodayTime(19, 0),
        scheduled_end: getTodayTime(20, 0),
        status: 'SCHEDULED',
      },
    }),
    // Tomorrow
    prisma.visit.create({
      data: {
        carer_id: carers[0].id,
        client_id: clients[1].id,
        scheduled_start: getTomorrowTime(9, 0),
        scheduled_end: getTomorrowTime(10, 0),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[1].id,
        client_id: clients[2].id,
        scheduled_start: getTomorrowTime(10, 30),
        scheduled_end: getTomorrowTime(11, 30),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[2].id,
        client_id: clients[3].id,
        scheduled_start: getTomorrowTime(13, 0),
        scheduled_end: getTomorrowTime(14, 0),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[3].id,
        client_id: clients[4].id,
        scheduled_start: getTomorrowTime(14, 30),
        scheduled_end: getTomorrowTime(15, 30),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[0].id,
        client_id: clients[0].id,
        scheduled_start: getTomorrowTime(16, 0),
        scheduled_end: getTomorrowTime(17, 0),
        status: 'SCHEDULED',
      },
    }),
    prisma.visit.create({
      data: {
        carer_id: carers[1].id,
        client_id: clients[1].id,
        scheduled_start: getTomorrowTime(18, 0),
        scheduled_end: getTomorrowTime(19, 0),
        status: 'SCHEDULED',
      },
    }),
  ]);

  // Add tasks to some visits
  await Promise.all([
    prisma.visitTask.create({
      data: {
        visit_id: visits[0].id,
        task_name: 'Administer morning medication',
        description: 'Paracetamol 500mg',
        is_completed: true,
        completed_at: getTodayTime(9, 15),
        notes: 'Patient took medication with water, no issues.',
      },
    }),
    prisma.visitTask.create({
      data: {
        visit_id: visits[1].id,
        task_name: 'Prepare lunch',
        description: 'Light meal with dietary restrictions',
        is_completed: true,
        completed_at: getTodayTime(11, 30),
        notes: 'Prepared soup and sandwich, client ate well.',
      },
    }),
    prisma.visitTask.create({
      data: {
        visit_id: visits[2].id,
        task_name: 'Medication review',
        description: 'Check compliance and side effects',
        is_completed: false,
      },
    }),
    prisma.visitTask.create({
      data: {
        visit_id: visits[3].id,
        task_name: 'Mobility assistance',
        description: 'Help with walking exercises',
        is_completed: false,
      },
    }),
  ]);

  // Count final data
  const counts = {
    organizations: await prisma.organization.count(),
    carers: await prisma.carer.count(),
    clients: await prisma.client.count(),
    medications: await prisma.medication.count(),
    prescriptions: await prisma.prescription.count(),
    visits: await prisma.visit.count(),
    visitTasks: await prisma.visitTask.count(),
  };

  console.log('✅ Seed completed:', counts);
  
  // Save summary
  const fs = await import('fs');
  fs.writeFileSync('./demo/output/seed-summary.json', JSON.stringify(counts, null, 2));
  
  return counts;
}

main()
  .then((counts) => {
    console.log('✅ Demo database seeded successfully');
    console.log(`📊 ${counts.visits} visits, ${counts.clients} clients, ${counts.carers} carers`);
  })
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
