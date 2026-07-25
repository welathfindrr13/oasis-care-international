import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlJwtAuthGuard } from './gql-jwt-auth.guard';

describe('GqlJwtAuthGuard', () => {
  function context(type: 'http' | 'graphql', request: Record<string, unknown>): ExecutionContext {
    return {
      getType: () => type,
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({
        getContext: () => undefined,
        getData: () => undefined,
      }),
      switchToWs: () => ({
        getClient: () => undefined,
        getData: () => undefined,
        getPattern: () => undefined,
      }),
    } as unknown as ExecutionContext;
  }

  it('bypasses authentication only when the endpoint is explicitly public', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new GqlJwtAuthGuard(reflector);

    expect(guard.canActivate(context('http', {}))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
  });

  it('uses the HTTP request for controller endpoints', () => {
    const reflector = new Reflector();
    const guard = new GqlJwtAuthGuard(reflector);
    const request = { headers: { authorization: 'Bearer redacted' } };

    expect(guard.getRequest(context('http', request))).toBe(request);
  });
});
