function assertSeedAllowed() {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'Demo seed is disabled in production, staging, and every non-local environment.',
    );
  }
}

async function main() {
  assertSeedAllowed();
  console.log('No demo seed data is created.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Seed disabled.');
  process.exit(1);
});
