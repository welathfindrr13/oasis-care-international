import { v4 as uuid } from 'uuid';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}
  
  use(req: any, _res: any, next: () => void) {
    const id = req.headers['x-request-id'] ?? uuid();
    this.cls.set('reqId', id);
    req.headers['x-request-id'] = id;
    next();
  }
}
