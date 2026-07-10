import { GraphQLError } from 'graphql';
import { ErrorCode } from '../errors/error-codes';
import { formatGraphQLError } from './graphql-error.filter';

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
});
