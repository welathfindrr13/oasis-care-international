import { GenericContainer, StartedTestContainer } from 'testcontainers';
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
    .start();

  const port = container.getMappedPort(5432);
  const host = container.getHost();
  const dbUrl = `postgresql://test:test@${host}:${port}/oasis_test`;

  // Create vector extension before running migrations
  execSync(
    `psql "${dbUrl}" -c "CREATE EXTENSION IF NOT EXISTS vector;"`,
    { stdio: 'inherit' }
  );

  // apply migrations
  execSync(
    `cd ../../libs/db && npx prisma migrate deploy`,
    { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'inherit' }
  );

  return { container, dbUrl };
}
