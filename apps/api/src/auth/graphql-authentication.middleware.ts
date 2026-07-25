import type { NextFunction, Request, Response } from "express";
import { parse, visit } from "graphql";

interface PassportFacade {
  authenticate(
    strategy: string,
    options: { session: boolean },
    callback: (
      error: unknown,
      user: Express.User | false | null | undefined,
    ) => void,
  ): (request: Request, response: Response, next: NextFunction) => void;
}

// Passport is already a Nest runtime dependency; keeping this narrow facade
// avoids adding a production dependency solely for ambient Express typings.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const passport = require("passport") as PassportFacade;

const UNAUTHENTICATED_GRAPHQL_RESPONSE = {
  data: null,
  errors: [
    {
      message: "Authentication required",
      extensions: { code: "UNAUTHENTICATED" },
    },
  ],
} as const;

function requiresTransportAuthentication(request: Request): boolean {
  if (request.method === "GET") return true;

  const query = typeof request.body?.query === "string" ? request.body.query : "";
  if (!query) return false;

  try {
    let containsIntrospectionField = false;
    visit(parse(query), {
      Field(node) {
        if (node.name.value.startsWith("__")) {
          containsIntrospectionField = true;
        }
      },
    });
    return containsIntrospectionField;
  } catch {
    return false;
  }
}

export function createGraphQLAuthenticationMiddleware() {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!requiresTransportAuthentication(request)) {
      next();
      return;
    }

    passport.authenticate(
      "jwt",
      { session: false },
      (_error: unknown, user: Express.User | false | null | undefined) => {
        if (user) {
          request.user = user;
          next();
          return;
        }

        response.status(200).json(UNAUTHENTICATED_GRAPHQL_RESPONSE);
      },
    )(request, response, next);
  };
}
