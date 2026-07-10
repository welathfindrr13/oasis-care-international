import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { execSync } from 'node:child_process';

export async function startPostgres(): Promise<{
  container: StartedTestContainer;
  dbUrl: string;
}> {
  const container = await new GenericContainer('pgvector/pgvector:pg16')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'oasis_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage('database system is ready to accept connections', 2),
    )
    .withStartupTimeout(120_000)
    .start();

  const port = container.getMappedPort(5432);
  const host = container.getHost();
  const dbUrl = `postgresql://test:test@${host}:${port}/oasis_test`;

  // Create vector extension from inside the running DB container.
  const createExtension = await container.exec([
    'psql',
    '-U',
    'test',
    '-d',
    'oasis_test',
    '-c',
    'CREATE EXTENSION IF NOT EXISTS vector;',
  ]);
  if (createExtension.exitCode !== 0) {
    throw new Error(`Failed to create vector extension: ${createExtension.output}`);
  }

  // apply migrations
  execSync(
    `cd ../../libs/db && npx prisma migrate deploy`,
    { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'inherit' }
  );

  return { container, dbUrl };
}
