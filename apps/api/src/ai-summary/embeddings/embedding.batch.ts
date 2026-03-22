import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { DateTime } from 'luxon';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_BEDROCK_SUMMARY_MODEL = 'anthropic.claude-haiku-4-5-20251001-v1:0';

interface BatchMetrics {
  startTime: DateTime;
  clientsProcessed: number;
  clientsFailed: number;
  totalLogs: number;
  embeddingsGenerated: number;
  summariesCreated: number;
  errors: Error[];
}

@Injectable()
export class EmbeddingBatchService {
  private readonly logger = new Logger(EmbeddingBatchService.name);
  private readonly bedrock: BedrockRuntimeClient;
  private healthSummaryPrompt: string;

  constructor(private readonly prisma: PrismaService) {
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'eu-west-2',
    });
    this.loadPromptTemplate();
  }

  private async loadPromptTemplate(): Promise<void> {
    try {
      const promptPath = path.join(process.cwd(), 'prompts', 'health-summary.md');
      this.healthSummaryPrompt = await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      this.logger.error('Failed to load health summary prompt template', error);
      throw new Error('Health summary prompt template not found');
    }
  }

  /**
   * Generate weekly health summaries for all clients with AI enabled
   * Runs every Friday 02:00 AM for previous week (Fri-Thu)
   */
  async generateWeeklySummaries(): Promise<void> {
    const metrics: BatchMetrics = {
      startTime: DateTime.now(),
      clientsProcessed: 0,
      clientsFailed: 0,
      totalLogs: 0,
      embeddingsGenerated: 0,
      summariesCreated: 0,
      errors: [],
    };

    try {
      this.logger.log('Starting weekly health summary generation');
      
      // Check if AI summary feature is enabled globally
      const aiEnabled = process.env.AI_SUMMARY_ENABLED_ENV === 'true';
      if (!aiEnabled) {
        this.logger.warn('AI summary generation skipped - feature disabled via environment variable');
        return;
      }

      const { periodStart, periodEnd } = this.calculateWeeklyPeriod();
      this.logger.log(`Generating summaries for period: ${periodStart.toISODate()} to ${periodEnd.toISODate()}`);

      // Get all clients with AI summary enabled  
      const clients = await this.prisma.client.findMany({
        where: {
          organization_id: {
            not: null,
          },
          organization: {
            ai_summary_enabled: true,
          },
        },
        include: {
          organization: true,
        },
      });

      this.logger.log(`Found ${clients.length} clients with AI summarization enabled`);

      for (const client of clients) {
        try {
          const clientStartTime = DateTime.now();
          await this.generateClientSummary(client.id, periodStart, periodEnd);
          
          const processingTime = DateTime.now().diff(clientStartTime).milliseconds;
          this.logger.log(`Client ${client.id} processed in ${processingTime}ms`);
          
          metrics.clientsProcessed++;
          metrics.summariesCreated++;
        } catch (error) {
          metrics.clientsFailed++;
          metrics.errors.push(error as Error);
          this.logger.error(`Failed to generate summary for client ${client.id}`, error);
        }
      }

      await this.logBatchMetrics(metrics);
      this.logger.log('Weekly health summary generation completed');
      
    } catch (error) {
      metrics.errors.push(error as Error);
      this.logger.error('Failed to complete weekly health summary generation', error);
      await this.logBatchMetrics(metrics);
      throw error;
    }
  }

  /**
   * Calculate the previous week's Friday-Thursday period
   * Called on Friday 02:00 AM to process the completed week
   */
  private calculateWeeklyPeriod(): { periodStart: DateTime; periodEnd: DateTime } {
    const now = DateTime.now().setZone('Europe/London');
    
    // Current execution should be Friday 02:00 AM
    // We want the previous 7 days: Friday to Thursday
    const periodEnd = now.startOf('day'); // Thursday 00:00 (end of period)
    const periodStart = periodEnd.minus({ days: 7 }); // Previous Friday 00:00 (start of period)
    
    return { periodStart, periodEnd };
  }

  private async generateClientSummary(
    clientId: string,
    periodStart: DateTime,
    periodEnd: DateTime,
  ): Promise<void> {
    this.logger.log(`Generating summary for client ${clientId}`);

    // 1. Collect all care logs for the period
    const careLogs = await this.collectCareLogs(clientId, periodStart, periodEnd);
    
    if (careLogs.length === 0) {
      this.logger.warn(`No care logs found for client ${clientId} in period ${periodStart.toISODate()} to ${periodEnd.toISODate()}`);
      return;
    }

    // 2. Generate embeddings for semantic search capability
    await this.generateLogEmbeddings(careLogs, clientId);

    // 3. Create AI health summary using Bedrock
    const healthSummary = await this.createHealthSummary(clientId, careLogs, periodStart, periodEnd);

    // 4. Store summary in database with expiration
    await this.storeSummary(clientId, healthSummary, periodStart, periodEnd);

    this.logger.log(`Successfully generated summary for client ${clientId}`);
  }

  private async collectCareLogs(
    clientId: string,
    periodStart: DateTime,
    periodEnd: DateTime,
  ): Promise<any[]> {
    // Collect all types of logs for this client in the period
    const visits = await this.prisma.visit.findMany({
      where: {
        client_id: clientId,
        scheduled_start: {
          gte: periodStart.toJSDate(),
          lt: periodEnd.toJSDate(),
        },
      },
      include: {
        tasks: true,
        medication_administrations: {
          include: {
            prescription: {
              include: {
                medication: true,
              },
            },
          },
        },
      },
    });

    // Transform visits into structured log entries
    const logs = visits.flatMap(visit => [
      // Visit completion log
      {
        visitId: visit.id,
        timestamp: visit.scheduled_start,
        logType: 'visit',
        data: {
          status: visit.status,
          notes: visit.notes,
          scheduled: visit.scheduled_start,
          actual_start: visit.actual_start,
          actual_end: visit.actual_end,
        },
      },
      // Task completion logs
      ...visit.tasks.map(task => ({
        visitId: visit.id,
        timestamp: task.completed_at || visit.scheduled_start,
        logType: 'task',
        data: {
          task: task.task_name,
          completed: task.is_completed,
          notes: task.notes,
        },
      })),
      // Medication administration logs
      ...visit.medication_administrations.map(med => ({
        visitId: visit.id,
        timestamp: med.administered_time || visit.scheduled_start,
        logType: 'medication',
        data: {
          medication: med.prescription.medication.name,
          status: med.status,
          scheduled_time: med.scheduled_time,
          administered_time: med.administered_time,
          notes: med.notes,
        },
      })),
    ]);

    return logs;
  }

  private async generateLogEmbeddings(logs: any[], clientId: string): Promise<void> {
    this.logger.log(`Generating embeddings for ${logs.length} log entries`);

    for (const log of logs) {
      try {
        // Create text representation for embedding
        const logText = this.formatLogForEmbedding(log);
        
        // Generate embedding using Bedrock
        const embedding = await this.generateEmbedding(logText);
        
        // Store in database (omit embedding field due to Prisma vector type limitation)
        await this.prisma.logEmbedding.create({
          data: {
            visit_id: log.visitId,
            log_type: log.logType,
            log_timestamp: log.timestamp,
            // embedding: `[${embedding.join(',')}]` as any, // TODO: Fix vector type support
            raw_data: log.data,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to generate embedding for log ${log.visitId}`, error);
      }
    }
  }

  private formatLogForEmbedding(log: any): string {
    const timestamp = DateTime.fromJSDate(log.timestamp).toFormat('yyyy-MM-dd HH:mm');
    const data = JSON.stringify(log.data);
    return `${timestamp} ${log.logType}: ${data}`;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use Bedrock's Titan embedding model for semantic search
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      body: JSON.stringify({
        inputText: text,
      }),
    });

    const response = await this.bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.embedding;
  }

  private async createHealthSummary(
    clientId: string,
    logs: any[],
    periodStart: DateTime,
    periodEnd: DateTime,
  ): Promise<any> {
    // Format logs for AI analysis
    const logsForAI = logs.map(log => ({
      timestamp: DateTime.fromJSDate(log.timestamp).toFormat('yyyy-MM-dd HH:mm'),
      type: log.logType,
      data: log.data,
    }));

    // Construct prompt with logs data
    const prompt = `${this.healthSummaryPrompt}

## Client Data for Analysis
Period: ${periodStart.toFormat('yyyy-MM-dd')} to ${periodEnd.toFormat('yyyy-MM-dd')} (Fri-Thu)

Care Logs:
${JSON.stringify(logsForAI, null, 2)}

Please analyze this week's care logs and generate the health summary in the specified JSON format.`;

    // Call the configured Bedrock summary model. Default to Haiku 4.5 so we
    // stay on a supported low-latency model as Claude 3 Haiku is retired.
    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL || DEFAULT_BEDROCK_SUMMARY_MODEL,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const response = await this.bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract JSON from Claude's response
    const summaryText = responseBody.content[0].text;
    const jsonMatch = summaryText.match(/```json\n([\s\S]*?)\n```/) || summaryText.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    return JSON.parse(jsonMatch[1]);
  }

  private async storeSummary(
    clientId: string,
    summaryData: any,
    periodStart: DateTime,
    periodEnd: DateTime,
  ): Promise<void> {
    // Calculate risk levels from summary data
    const riskLevels = this.calculateOverallRisk(summaryData);
    
    // Store in database with 24-hour expiration
    await this.prisma.healthSummary.create({
      data: {
        client_id: clientId,
        period_start: periodStart.toJSDate(),
        period_end: periodEnd.toJSDate(),
        summary_json: summaryData,
        risk_levels: riskLevels,
        generated_at: new Date(),
        generated_by: 'ai',
        expires_at: DateTime.now().plus({ hours: 24 }).toJSDate(),
      },
    });
  }

  private calculateOverallRisk(summaryData: any): any {
    const risks = {
      overall: 'green',
      vitals: 'green',
      medication: 'green',
      mobility: 'green',
      cognitive: 'green',
    };

    // Analyze each section for highest risk level
    const sections = ['vitals', 'toileting', 'missedMeds', 'risks'];
    
    for (const section of sections) {
      if (summaryData[section]) {
        const sectionRisks = summaryData[section].map((item: any) => item.riskLevel || 'green');
        const highestRisk = this.getHighestRisk(sectionRisks);
        
        if (section === 'vitals') risks.vitals = highestRisk;
        if (section === 'missedMeds') risks.medication = highestRisk;
        if (section === 'risks') {
          // Map risk categories to our risk types
          summaryData[section].forEach((risk: any) => {
            if (risk.category === 'falls') risks.mobility = this.getHighestRisk([risks.mobility, risk.riskLevel]);
            if (risk.category === 'deterioration') risks.cognitive = this.getHighestRisk([risks.cognitive, risk.riskLevel]);
          });
        }
      }
    }

    // Calculate overall risk
    const allRisks = Object.values(risks).filter(r => r !== 'green');
    risks.overall = allRisks.length > 0 ? this.getHighestRisk(allRisks as string[]) : 'green';

    return risks;
  }

  private getHighestRisk(risks: string[]): string {
    if (risks.includes('red')) return 'red';
    if (risks.includes('amber')) return 'amber';
    return 'green';
  }

  /**
   * Log batch processing metrics for monitoring and alerting
   */
  private async logBatchMetrics(metrics: BatchMetrics): Promise<void> {
    const duration = DateTime.now().diff(metrics.startTime);
    const durationMs = duration.milliseconds;
    
    const summary = {
      duration_ms: durationMs,
      clients_processed: metrics.clientsProcessed,
      clients_failed: metrics.clientsFailed,
      total_logs: metrics.totalLogs,
      embeddings_generated: metrics.embeddingsGenerated,
      summaries_created: metrics.summariesCreated,
      error_count: metrics.errors.length,
      success_rate: metrics.clientsProcessed + metrics.clientsFailed > 0 
        ? (metrics.clientsProcessed / (metrics.clientsProcessed + metrics.clientsFailed) * 100).toFixed(2) + '%'
        : '0%'
    };

    this.logger.log('Batch processing metrics:', summary);

    // Log individual errors for debugging
    if (metrics.errors.length > 0) {
      this.logger.error(`Batch completed with ${metrics.errors.length} errors:`);
      metrics.errors.forEach((error, index) => {
        this.logger.error(`Error ${index + 1}: ${error.message}`, error.stack);
      });
    }

    // In a production environment, you would send these metrics to CloudWatch
    // using the CloudWatch client. For now, we'll just log them.
    try {
      // Custom metric logging - would integrate with CloudWatch in production
      console.log(`METRIC: summary_batch_duration_ms=${durationMs}`);
      console.log(`METRIC: summary_batch_success_rate=${summary.success_rate}`);
      console.log(`METRIC: summary_batch_clients_processed=${metrics.clientsProcessed}`);
      console.log(`METRIC: summary_batch_clients_failed=${metrics.clientsFailed}`);
    } catch (error) {
      this.logger.warn('Failed to send custom metrics', error);
    }
  }
}
