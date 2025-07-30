import { Catch, ArgumentsHost } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';
import { Masker } from '../utils/masker';

@Catch(BaseHttpException)
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: BaseHttpException, _host: ArgumentsHost) {
    const { code, message } = exception.getResponse() as any;

    return new GraphQLError(Masker.mask(message), {
      extensions: { code },
    });
  }
}
