import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';

export async function startPostgres(): Promise<{
  container: StartedPostgreSqlContainer;
  dbUrl: string;
}> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('oasis_test')
    .withUsername('test')
    .withPassword('test')
    .withStartupTimeout(120000)
    .start();

  const port = container.getMappedPort(5432);
  const host = container.getHost();
  const dbUrl = `postgresql://test:test@${host}:${port}/oasis_test`;

  // Create vector extension inside the container so the host does not need psql installed.
  const extensionResult = await container.exec([
    'psql',
    '-U',
    'test',
    '-d',
    'oasis_test',
    '-c',
    'CREATE EXTENSION IF NOT EXISTS vector;',
  ]);

  if (extensionResult.exitCode !== 0) {
    throw new Error(
      `Failed to create vector extension: ${extensionResult.output}`
    );
  }

  // apply migrations
  execSync(
    `cd ../../libs/db && npx prisma migrate deploy`,
    { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'inherit' }
  );

  return { container, dbUrl };
}
