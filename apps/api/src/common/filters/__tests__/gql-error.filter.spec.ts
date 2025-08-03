import { ArgumentsHost } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { GqlErrorFilter } from '../gql-error.filter';
import { ErrorCode } from '../../errors/error-codes';
import { BaseHttpException } from '../../errors/base-http.exception';

describe('GqlErrorFilter', () => {
  let filter: GqlErrorFilter;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GqlErrorFilter();
    mockHost = {} as ArgumentsHost;
  });

  it('should handle BaseHttpException with code and message', () => {
    const exception = new BaseHttpException(
      ErrorCode.VISIT_OVERLAP,
      'Visit overlaps with existing schedule',
      409,
    );

    const result = filter.catch(exception, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Visit overlaps with existing schedule');
    expect(result.extensions).toEqual({ code: ErrorCode.VISIT_OVERLAP });
    // Stack traces are not exposed in GraphQL responses to clients
    expect(result.stack).toBeDefined();
  });

  it('should handle nested originalError with response', () => {
    const nestedError = {
      originalError: {
        response: {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid input provided',
        },
      },
    };

    const result = filter.catch(nestedError, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Invalid input provided');
    expect(result.extensions).toEqual({ code: ErrorCode.VALIDATION_FAILED });
    expect(result.stack).toBeDefined();
  });

  it('should handle exception with response directly', () => {
    const exception = {
      response: {
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied',
      },
    };

    const result = filter.catch(exception, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Access denied');
    expect(result.extensions).toEqual({ code: ErrorCode.FORBIDDEN });
    expect(result.stack).toBeDefined();
  });

  it('should default to INTERNAL_ERROR for unknown exceptions', () => {
    const exception = new Error('Some random error');

    const result = filter.catch(exception, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Internal error');
    expect(result.extensions).toEqual({ code: ErrorCode.INTERNAL_ERROR });
    expect(result.stack).toBeDefined();
  });

  it('should mask sensitive data in error messages', () => {
    const exception = {
      response: {
        code: ErrorCode.VALIDATION_FAILED,
        message: 'User john@example.com failed validation for phone 07911123456',
      },
    };

    const result = filter.catch(exception, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('User j***@example.com failed validation for phone 07*** *** ***');
    expect(result.extensions).toEqual({ code: ErrorCode.VALIDATION_FAILED });
    expect(result.stack).toBeDefined();
  });

  it('should handle null/undefined exceptions gracefully', () => {
    const result = filter.catch(null, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Internal error');
    expect(result.extensions).toEqual({ code: ErrorCode.INTERNAL_ERROR });
    expect(result.stack).toBeDefined();
  });

  it('should preserve error code when message is undefined', () => {
    const exception = {
      response: {
        code: ErrorCode.VISIT_NOT_FOUND,
        // message is undefined
      },
    };

    const result = filter.catch(exception, mockHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe('Internal error');
    expect(result.extensions).toEqual({ code: ErrorCode.VISIT_NOT_FOUND });
    expect(result.stack).toBeDefined();
  });
});
