import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";

export const PLATFORM_ACTION_HEADER = "x-oasis-platform-action";

function splitSubjects(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean),
  );
}

@Injectable()
export class GqlPlatformOperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const gql = GqlExecutionContext.create(context);
    const request = gql.getContext()?.req;
    const user = request?.user;
    const operatorOrganizationId = String(
      process.env.PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID || "",
    ).trim();
    const operatorSubjects = splitSubjects(
      process.env.PLATFORM_OPERATOR_CLERK_SUBJECTS,
    );
    const subject = String(user?.sub || user?.id || "").trim();

    const authorized =
      user?.authProvider === "clerk" &&
      operatorOrganizationId.length > 0 &&
      user?.organizationId === operatorOrganizationId &&
      operatorSubjects.has(subject);

    if (!authorized) {
      throw new ForbiddenException("Platform operator access required");
    }

    const info = gql.getInfo();
    if (
      info?.operation?.operation === "mutation" &&
      request?.headers?.[PLATFORM_ACTION_HEADER] !== "1"
    ) {
      throw new ForbiddenException("Platform action confirmation required");
    }

    return true;
  }
}
