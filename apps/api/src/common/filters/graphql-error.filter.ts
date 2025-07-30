import { GraphQLError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';
import { Masker } from '../utils/masker';

export function formatGraphQLError(error: GraphQLError): GraphQLError {
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
  
  const originalError = error.originalError;
  
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
    const maskedMessage = Masker.mask(error.message);
    return new GraphQLError(maskedMessage, {
      extensions: {
        code: error.extensions.code,
        originalError: undefined,
      },
    });
  }
  
  // Handle other errors
  const maskedMessage = Masker.mask(error.message);
  return new GraphQLError(maskedMessage, {
    extensions: {
      code: ErrorCode.INTERNAL_ERROR,
      originalError: undefined,
    },
  });
}
