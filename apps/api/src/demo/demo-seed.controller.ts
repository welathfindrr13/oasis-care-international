import { Controller, Post, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

interface DemoSeedResponse {
  success: boolean;
  message: string;
  counts: {
    organizations: number;
    carers: number;
    clients: number;
    medications: number;
    prescriptions: number;
    visits: number;
    visitTasks: number;
  };
  adminCarer?: {
    id: string;
    email: string;
    name: string;
  };
}

@Controller('demo-seed')
export class DemoSeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async seedDemo(
    @Headers('x-seed-key') seedKey: string,
  ): Promise<DemoSeedResponse> {
    // Validate seed key
    const expectedKey = process.env.DEMO_SEED_TOKEN;
    if (!expectedKey || seedKey !== expectedKey) {
      throw new HttpException('Invalid or missing seed key', HttpStatus.UNAUTHORIZED);
    }

    try {
      console.log('🌱 Starting demo database seeding...');

      // Get environment variables
      const adminEmail = process.env.DEMO_ADMIN_EMAIL;
      const adminPassword = process.env.DEMO_ADMIN_PASSWORD;

      if (!adminEmail) {
        throw new HttpException('DEMO_ADMIN_EMAIL environment variable is required', HttpStatus.BAD_REQUEST);
      }

      // Clear existing demo data (idempotent)
      await this.clearDemoData();

      // Create or find organization with name "Oasis Demo"
      let org = await this.prisma.organization.findFirst({
        where: { name: 'Oasis Demo' }
      });
      
      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: 'Oasis Demo',
            ai_summary_enabled: true,
          }
        });
      }

      // Create demo medications
      const medications = await Promise.all([
        this.prisma.medication.create({
          data: { name: 'Paracetamol', dosage: '500', unit: 'mg', instructions: 'Take with food' },
        }),
        this.prisma.medication.create({
          data: { name: 'Lisinopril', dosage: '10', unit: 'mg', instructions: 'Take in morning' },
        }),
        this.prisma.medication.create({
          data: { name: 'Metformin', dosage: '500', unit: 'mg', instructions: 'Take with meals' },
        }),
      ]);

      // Create admin carer (acts as admin user)
      // Note: Password handling would be done by authentication service
      const adminCarer = await this.prisma.carer.create({
        data: {
          first_name: 'Admin',
          last_name: 'Demo',
          email: adminEmail,
          phone: '+44 20 7946 0999',
          hire_date: new Date(),
          is_active: true,
        },
      });

      // Create demo carers
      const carers = await Promise.all([
        adminCarer, // Include admin carer
        this.prisma.carer.create({
          data: {
            first_name: 'Sarah',
            last_name: 'Johnson',
            email: 'carer.sarah@demo.local',
            phone: '+44 20 7946 0958',
            hire_date: new Date('2023-01-15'),
          },
        }),
        this.prisma.carer.create({
          data: {
            first_name: 'Mike',
            last_name: 'Thompson',
            email: 'carer.mike@demo.local',
            phone: '+44 20 7946 0959',
            hire_date: new Date('2023-03-22'),
          },
        }),
      ]);

      // Create demo clients
      const clients = await Promise.all([
        this.prisma.client.create({
          data: {
            full_name: 'Margaret Thompson',
            address_line1: '42 Baker Street',
            city: 'London',
            postcode: 'NW1 6XE',
            date_of_birth: new Date('1948-03-15'),
            organization_id: org.id,
          },
        }),
        this.prisma.client.create({
          data: {
            full_name: 'Robert Smith',
            address_line1: '15 Downing Street',
            city: 'London',
            postcode: 'SW1A 2AA',
            date_of_birth: new Date('1952-07-22'),
            organization_id: org.id,
          },
        }),
      ]);

      // Create prescriptions
      const prescriptions = await Promise.all([
        this.prisma.prescription.create({
          data: {
            client_id: clients[0].id,
            medication_id: medications[0].id,
            start_date: new Date(),
            frequency_per_day: 2,
            frequency_interval_hours: 12,
            administration_times: ['08:00', '20:00'],
          },
        }),
        this.prisma.prescription.create({
          data: {
            client_id: clients[1].id,
            medication_id: medications[1].id,
            start_date: new Date(),
            frequency_per_day: 1,
            frequency_interval_hours: 24,
            administration_times: ['08:00'],
          },
        }),
      ]);

      // Create today's visits
      const today = new Date();
      const getTodayTime = (hour: number, minute: number = 0) => {
        const time = new Date(today);
        time.setHours(hour, minute, 0, 0);
        return time;
      };

      const visits = await Promise.all([
        // Completed visit
        this.prisma.visit.create({
          data: {
            carer_id: carers[1].id,
            client_id: clients[0].id,
            scheduled_start: getTodayTime(9, 0),
            scheduled_end: getTodayTime(10, 0),
            actual_start: getTodayTime(9, 5),
            actual_end: getTodayTime(10, 10),
            status: 'COMPLETED',
            notes: 'Morning medication administered successfully.',
          },
        }),
        // Upcoming visit
        this.prisma.visit.create({
          data: {
            carer_id: carers[2].id,
            client_id: clients[1].id,
            scheduled_start: getTodayTime(14, 0),
            scheduled_end: getTodayTime(15, 0),
            status: 'SCHEDULED',
          },
        }),
      ]);

      // Create visit tasks
      await Promise.all([
        this.prisma.visitTask.create({
          data: {
            visit_id: visits[0].id,
            task_name: 'Administer morning medication',
            description: 'Paracetamol 500mg',
            is_completed: true,
            completed_at: getTodayTime(9, 15),
            notes: 'Patient took medication with water, no issues.',
          },
        }),
        this.prisma.visitTask.create({
          data: {
            visit_id: visits[1].id,
            task_name: 'Check blood pressure',
            description: 'Record morning BP reading',
            is_completed: false,
          },
        }),
      ]);

      // Create medication administration for today
      await this.prisma.medicationAdministration.create({
        data: {
          prescription_id: prescriptions[0].id,
          visit_id: visits[0].id,
          scheduled_time: getTodayTime(8, 0),
          administered_time: getTodayTime(9, 15),
          administered_by: adminCarer.id,
          status: 'ADMINISTERED',
          notes: 'Administered during morning visit',
        },
      });

      // Get final counts
      const counts = {
        organizations: await this.prisma.organization.count(),
        carers: await this.prisma.carer.count(),
        clients: await this.prisma.client.count(),
        medications: await this.prisma.medication.count(),
        prescriptions: await this.prisma.prescription.count(),
        visits: await this.prisma.visit.count(),
        visitTasks: await this.prisma.visitTask.count(),
      };

      console.log('✅ Demo database seeded successfully:', counts);

      return {
        success: true,
        message: 'Demo database seeded successfully',
        counts,
        adminCarer: {
          id: adminCarer.id,
          email: adminCarer.email,
          name: `${adminCarer.first_name} ${adminCarer.last_name}`,
        },
      };

    } catch (error) {
      console.error('❌ Demo seed failed:', error);
      throw new HttpException(
        `Demo seed failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async clearDemoData(): Promise<void> {
    // Clear in correct order to respect foreign key constraints
    await this.prisma.visitTask.deleteMany();
    await this.prisma.medicationAdministration.deleteMany();
    await this.prisma.visit.deleteMany();
    await this.prisma.prescription.deleteMany();
    await this.prisma.medication.deleteMany();
    await this.prisma.carer.deleteMany();
    await this.prisma.client.deleteMany();
    
    // Only delete demo organization
    await this.prisma.organization.deleteMany({
      where: { name: 'Oasis Demo' }
    });
  }
}
