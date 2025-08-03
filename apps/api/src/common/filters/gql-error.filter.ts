import { ArgumentsHost, Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Masker } from '../utils/masker';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class GqlErrorFilter implements GqlExceptionFilter {
  catch(exception: any, _host: ArgumentsHost) {
    const orig = exception?.originalError ?? exception;
    const { code = ErrorCode.INTERNAL_ERROR, message } = orig?.response ?? {};
    return new GraphQLError(Masker.mask(message ?? 'Internal error'), {
      extensions: { code },
    });
  }
}
