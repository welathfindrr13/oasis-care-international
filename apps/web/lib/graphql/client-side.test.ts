import test from 'node:test';
import assert from 'node:assert/strict';

import { clientQuery } from './client-side';

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;
const originalConsoleError = console.error;

function installFetchMock(responseBody: unknown) {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => responseBody,
    } as Response;
  }) as typeof fetch;

  return requests;
}

function getAuthorizationHeader(init?: RequestInit): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).window = originalWindow;
  console.error = originalConsoleError;
});

test('clientQuery sends Clerk session bearer when available in the browser', async () => {
  const requests = installFetchMock({ data: { careRooms: [] } });
  (globalThis as any).window = {
    Clerk: {
      session: {
        getToken: async () => 'clerk.session.jwt',
      },
    },
  };

  await clientQuery('{ careRooms { id } }');

  assert.equal(getAuthorizationHeader(requests[0].init), 'Bearer clerk.session.jwt');
});

test('clientQuery preserves caller-provided Authorization over Clerk token', async () => {
  const requests = installFetchMock({ data: { careRooms: [] } });
  (globalThis as any).window = {
    Clerk: {
      session: {
        getToken: async () => 'clerk.session.jwt',
      },
    },
  };

  await clientQuery('{ careRooms { id } }', undefined, {
    headers: { Authorization: 'Bearer caller.jwt' },
  });

  assert.equal(getAuthorizationHeader(requests[0].init), 'Bearer caller.jwt');
});

test('clientQuery keeps cookie-only behavior when Clerk is absent or has no token', async () => {
  const requests = installFetchMock({ data: { careRooms: [] } });
  (globalThis as any).window = {};

  await clientQuery('{ careRooms { id } }');

  assert.equal(getAuthorizationHeader(requests[0].init), undefined);
  assert.equal(requests[0].init?.credentials, 'include');
});

test('clientQuery does not log token material while attaching Clerk bearer', async () => {
  const requests = installFetchMock({ data: { careRooms: [] } });
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  (globalThis as any).window = {
    Clerk: {
      load: async () => undefined,
      session: {
        getToken: async () => 'sensitive.clerk.jwt',
      },
    },
  };

  await clientQuery('{ careRooms { id } }');

  assert.equal(getAuthorizationHeader(requests[0].init), 'Bearer sensitive.clerk.jwt');
  assert.deepEqual(logged, []);
});
