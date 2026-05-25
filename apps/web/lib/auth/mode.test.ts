import test from 'node:test';
import assert from 'node:assert/strict';

import { isLocalAuthEnabled, resolveAuthMode } from './mode';

test('resolveAuthMode returns cognito by default in development', () => {
  const mode = resolveAuthMode({
    NODE_ENV: 'development',
    LOCAL_AUTH_ENABLED: undefined,
  } as NodeJS.ProcessEnv);

  assert.equal(mode, 'cognito');
  assert.equal(isLocalAuthEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), false);
});

test('resolveAuthMode returns local only when enabled in development', () => {
  const mode = resolveAuthMode({
    NODE_ENV: 'development',
    LOCAL_AUTH_ENABLED: 'true',
  } as NodeJS.ProcessEnv);

  assert.equal(mode, 'local');
  assert.equal(
    isLocalAuthEnabled({
      NODE_ENV: 'development',
      LOCAL_AUTH_ENABLED: 'true',
    } as NodeJS.ProcessEnv),
    true,
  );
});

test('resolveAuthMode does not allow local mode outside development', () => {
  const mode = resolveAuthMode({
    NODE_ENV: 'production',
    LOCAL_AUTH_ENABLED: 'true',
  } as NodeJS.ProcessEnv);

  assert.equal(mode, 'cognito');
  assert.equal(
    isLocalAuthEnabled({
      NODE_ENV: 'production',
      LOCAL_AUTH_ENABLED: 'true',
    } as NodeJS.ProcessEnv),
    false,
  );
});

test('NEXT_PUBLIC_LOCAL_AUTH_ENABLED also enables local mode in development', () => {
  const mode = resolveAuthMode({
    NODE_ENV: 'development',
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: 'true',
  } as NodeJS.ProcessEnv);

  assert.equal(mode, 'local');
});
