import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Type,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

const JwtAuthGuard = AuthGuard("jwt") as Type<CanActivate>;

@Injectable()
export class GqlJwtAuthGuard extends JwtAuthGuard {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext()?.req;
  }
}
