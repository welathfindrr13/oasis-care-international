import { ArgumentsHost, Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Masker } from '../utils/masker';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class GqlErrorFilter implements GqlExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const contextType =
      typeof host?.getType === 'function' ? (host.getType() as string) : 'graphql';

    if (contextType !== 'graphql') {
      throw exception;
    }

    const orig = exception?.originalError ?? exception;
    const response = orig?.response ?? {};
    const rawMessage =
      Array.isArray(response?.message) && response.message.length > 0
        ? response.message[0]
        : response?.message ?? 'Internal error';
    const maskedMessage = String(Masker.mask(String(rawMessage)));
    const statusCode =
      response?.statusCode ??
      response?.status ??
      orig?.statusCode ??
      orig?.status;

    const mappedCode =
      response?.code ??
      (statusCode === 401
        ? ErrorCode.UNAUTHORIZED
        : statusCode === 403
        ? ErrorCode.FORBIDDEN
        : statusCode === 400
        ? ErrorCode.VALIDATION_FAILED
        : ErrorCode.INTERNAL_ERROR);

    return new GraphQLError(maskedMessage, {
      extensions: { code: mappedCode },
    });
  }
}
