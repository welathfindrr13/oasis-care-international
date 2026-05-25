import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Masker } from '../utils/masker';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const contextType =
      typeof host?.getType === 'function' ? (host.getType() as string) : 'http';

    if (contextType !== 'http') {
      return exception;
    }

    const ctx = typeof host?.switchToHttp === 'function' ? host.switchToHttp() : null;
    if (
      !ctx ||
      typeof ctx.getRequest !== 'function' ||
      typeof ctx.getResponse !== 'function'
    ) {
      throw exception;
    }

    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const requestPath = String(req?.url ?? '');

    // GraphQL operations should be handled by GraphQL filters/formatters.
    if (requestPath.startsWith('/graphql')) {
      throw exception;
    }

    if (
      !res ||
      typeof res.status !== 'function' ||
      typeof res.json !== 'function' ||
      res.headersSent
    ) {
      throw exception;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const respPayload =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Internal server error',
          };

    const maskedMsg = Masker.mask(respPayload.message || '');

    // log masked message only
    this.logger.error(
      `${req.method} ${req.url} → ${status} :: ${maskedMsg}`,
    );

    res.status(status).json({
      code: respPayload.code ?? ErrorCode.INTERNAL_ERROR,
      message: maskedMsg,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
