import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';
import { Masker } from '../utils/masker';
import {
  graphQLOperationRejectedError,
  isGraphQLOperationLimitError,
} from '../../security/graphql-operation-guards';

const INTERNAL_ERROR_MESSAGE = 'An internal error occurred';

export function formatGraphQLError(
  error: GraphQLError | GraphQLFormattedError,
  rawError?: unknown,
): GraphQLError {
  if (isGraphQLOperationLimitError(error, rawError)) {
    return graphQLOperationRejectedError();
  }

  // Check if the error itself is a BaseHttpException
  if (error instanceof BaseHttpException) {
    const response = error.getResponse() as any;
    const maskedMessage = Masker.mask(response.message);

    return new GraphQLError(maskedMessage, {
      extensions: {
        code: response.code,
        originalError: undefined,
      },
    });
  }

  const originalError =
    error instanceof GraphQLError ? error.originalError : undefined;

  // Handle BaseHttpException wrapped in GraphQLError
  if (originalError instanceof BaseHttpException) {
    const response = originalError.getResponse() as any;
    const maskedMessage = Masker.mask(response.message);

    return new GraphQLError(maskedMessage, {
      extensions: {
        code: response.code,
        originalError: undefined,
      },
    });
  }

  // Check if error has extensions with a code already
  if (error.extensions?.code) {
    const code = String(error.extensions.code);
    if (code === 'INTERNAL_SERVER_ERROR' || code === ErrorCode.INTERNAL_ERROR) {
      return internalGraphQLError();
    }
    const maskedMessage = Masker.mask(error.message);
    return new GraphQLError(maskedMessage, {
      extensions: {
        code,
        originalError: undefined,
      },
    });
  }

  // Handle other errors
  return internalGraphQLError();
}

function internalGraphQLError(): GraphQLError {
  return new GraphQLError(INTERNAL_ERROR_MESSAGE, {
    extensions: {
      code: ErrorCode.INTERNAL_ERROR,
      originalError: undefined,
    },
  });
}
