import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  withdrawnAt?: Date;
  legalBasis: string;
  metadata?: Record<string, any>;
}

export interface GrantConsentInput {
  userId: string;
  consentType: string;
  purpose: string;
  legalBasis: string;
  metadata?: Record<string, any>;
}

export interface ConsentStatus {
  consentType: string;
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
}

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant consent for a specific purpose
   * Creates a new consent record or updates existing one
   */
  async grantConsent(input: GrantConsentInput): Promise<ConsentRecord> {
    const { userId, consentType, purpose, legalBasis, metadata } = input;

    // Check if there's an existing consent record for this type
    const existing = await this.prisma.consentRecord.findFirst({
      where: {
        user_id: userId,
        consent_type: consentType,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // If already granted and not withdrawn, return existing
    if (existing && existing.granted && !existing.withdrawn_at) {
      return this.mapToConsentRecord(existing);
    }

    // Create new consent record
    const record = await this.prisma.consentRecord.create({
      data: {
        user_id: userId,
        consent_type: consentType,
        purpose,
        granted: true,
        granted_at: new Date(),
        legal_basis: legalBasis,
        metadata: metadata || {},
      },
    });

    return this.mapToConsentRecord(record);
  }

  /**
   * Withdraw consent for a specific type
   */
  async withdrawConsent(userId: string, consentType: string): Promise<ConsentRecord> {
    // Find the active consent record
    const existing = await this.prisma.consentRecord.findFirst({
      where: {
        user_id: userId,
        consent_type: consentType,
        granted: true,
        withdrawn_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!existing) {
      throw new NotFoundException(`No active consent found for type: ${consentType}`);
    }

    // Update the record to mark as withdrawn
    const record = await this.prisma.consentRecord.update({
      where: { id: existing.id },
      data: {
        withdrawn_at: new Date(),
      },
    });

    return this.mapToConsentRecord(record);
  }

  /**
   * Get all consent records for a user
   */
  async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    const records = await this.prisma.consentRecord.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return records.map(this.mapToConsentRecord);
  }

  /**
   * Get current consent status for all types for a user
   */
  async getConsentStatus(userId: string): Promise<ConsentStatus[]> {
    const records = await this.prisma.consentRecord.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    // Group by consent type and get latest status
    const statusMap = new Map<string, ConsentStatus>();
    
    for (const record of records) {
      if (!statusMap.has(record.consent_type)) {
        statusMap.set(record.consent_type, {
          consentType: record.consent_type,
          granted: record.granted && !record.withdrawn_at,
          grantedAt: record.granted_at,
          withdrawnAt: record.withdrawn_at || undefined,
        });
      }
    }

    return Array.from(statusMap.values());
  }

  /**
   * Check if a user has granted consent for a specific type
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const record = await this.prisma.consentRecord.findFirst({
      where: {
        user_id: userId,
        consent_type: consentType,
        granted: true,
        withdrawn_at: null,
      },
    });

    return !!record;
  }

  /**
   * Verify consent before data processing (middleware helper)
   */
  async verifyConsentForProcessing(userId: string, requiredConsents: string[]): Promise<{
    allowed: boolean;
    missingConsents: string[];
  }> {
    const missingConsents: string[] = [];

    for (const consentType of requiredConsents) {
      const hasIt = await this.hasConsent(userId, consentType);
      if (!hasIt) {
        missingConsents.push(consentType);
      }
    }

    return {
      allowed: missingConsents.length === 0,
      missingConsents,
    };
  }

  private mapToConsentRecord(record: any): ConsentRecord {
    return {
      id: record.id,
      userId: record.user_id,
      consentType: record.consent_type,
      purpose: record.purpose,
      granted: record.granted,
      grantedAt: record.granted_at,
      withdrawnAt: record.withdrawn_at || undefined,
      legalBasis: record.legal_basis,
      metadata: record.metadata as Record<string, any> | undefined,
    };
  }
}
