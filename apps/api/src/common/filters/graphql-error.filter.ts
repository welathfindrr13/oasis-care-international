import { HttpException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';
import { Masker } from '../utils/masker';

function toMaskedGraphQLError(message: string, code: string): GraphQLError {
  return new GraphQLError(Masker.mask(message), {
    extensions: {
      code,
      originalError: undefined,
    },
  });
}

export function formatGraphQLError(error: GraphQLError): GraphQLError {
  // Check if the error itself is a BaseHttpException
  if (error instanceof BaseHttpException) {
    const response = error.getResponse() as any;
    return toMaskedGraphQLError(response.message, response.code);
  }
  
  const originalError = error.originalError;
  
  // Handle BaseHttpException wrapped in GraphQLError
  if (originalError instanceof BaseHttpException) {
    const response = originalError.getResponse() as any;
    return toMaskedGraphQLError(response.message, response.code);
  }

  if (originalError instanceof HttpException) {
    const response = originalError.getResponse() as any;
    const code = typeof response === 'object' && response?.code
      ? response.code
      : error.extensions?.code || ErrorCode.INTERNAL_ERROR;
    const message = typeof response === 'object' && response?.message
      ? response.message
      : error.message;

    return toMaskedGraphQLError(message, code);
  }
  
  // Check if error has extensions with a code already
  if (error.extensions?.code) {
    return toMaskedGraphQLError(error.message, String(error.extensions.code));
  }
  
  // Handle other errors
  return toMaskedGraphQLError(error.message, ErrorCode.INTERNAL_ERROR);
}
