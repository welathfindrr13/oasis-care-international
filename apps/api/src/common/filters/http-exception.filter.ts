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
    // Skip if this isn't an HTTP request (e.g. GraphQL, WebSocket)
    if (host.getType() !== 'http') {
      return exception; // hand off to the next filter (GQL)
    }

    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

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
