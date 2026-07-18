import { GraphQLError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';
import { formatGraphQLError } from './graphql-error.filter';
import { GRAPHQL_OPERATION_REJECTED } from '../../security/graphql-operation-guards';

describe('formatGraphQLError', () => {
  it('replaces unknown exception details with a fixed internal error', () => {
    const error = new GraphQLError('database private-host table membership failed', {
      originalError: new Error('postgresql://user:secret@private-host/internal'),
    });

    const formatted = formatGraphQLError(error);

    expect(formatted.message).toBe('An internal error occurred');
    expect(formatted.extensions).toEqual({
      code: ErrorCode.INTERNAL_ERROR,
      originalError: undefined,
    });
  });

  it.each(['INTERNAL_SERVER_ERROR', ErrorCode.INTERNAL_ERROR])(
    'sanitizes GraphQL errors already marked %s',
    (code) => {
      const formatted = formatGraphQLError(
        new GraphQLError('column organization_membership.carer_id does not exist', {
          extensions: { code },
        }),
      );

      expect(formatted.message).toBe('An internal error occurred');
      expect(formatted.extensions.code).toBe(ErrorCode.INTERNAL_ERROR);
    },
  );

  it('preserves a known authorization error while masking personal data', () => {
    const formatted = formatGraphQLError(
      new GraphQLError('Forbidden for person@example.test', {
        extensions: { code: 'FORBIDDEN' },
      }),
    );

    expect(formatted.message).toBe('Forbidden for p***@example.test');
    expect(formatted.extensions.code).toBe('FORBIDDEN');
  });

  it('preserves a BaseHttpException thrown from an Apollo resolver guard', () => {
    const exception = new BaseHttpException(
      ErrorCode.FEATURE_NOT_ENABLED,
      'Medication and eMAR are not available for this launch.',
      403,
    );
    const rawError = new GraphQLError('Forbidden resource', {
      path: ['recordAdministration'],
      originalError: exception,
    });
    const formatted = formatGraphQLError(
      new GraphQLError('Forbidden resource', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      }),
      rawError,
    );

    expect(formatted.message).toBe(
      'Medication and eMAR are not available for this launch.',
    );
    expect(formatted.extensions).toEqual({
      code: ErrorCode.FEATURE_NOT_ENABLED,
      originalError: undefined,
    });
  });

  it('maps native parser token-limit errors to a stable redacted response', () => {
    const parserError = new GraphQLError(
      'Document contains more that 2000 tokens. Parsing aborted.',
    );
    const apolloError = new GraphQLError(parserError.message, {
      originalError: parserError,
      extensions: { code: 'GRAPHQL_PARSE_FAILED' },
    });

    const formatted = formatGraphQLError(apolloError, apolloError);

    expect(formatted.message).toBe('GraphQL operation rejected');
    expect(formatted.extensions).toEqual({
      code: GRAPHQL_OPERATION_REJECTED,
    });
    expect(JSON.stringify(formatted)).not.toContain('2000');
    expect(JSON.stringify(formatted)).not.toContain('Parsing aborted');
  });

  it('does not classify a token-shaped BAD_USER_INPUT message as a parser limit', () => {
    const message = 'Document contains more than 2000 tokens. Parsing aborted.';
    const formatted = formatGraphQLError(
      new GraphQLError(message, {
        extensions: { code: 'BAD_USER_INPUT' },
      }),
    );

    expect(formatted.message).toBe(message);
    expect(formatted.extensions).toEqual({
      code: 'BAD_USER_INPUT',
      originalError: undefined,
    });
  });
});
