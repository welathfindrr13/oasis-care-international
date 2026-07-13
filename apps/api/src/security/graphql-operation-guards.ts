import {
  ASTVisitor,
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
  ValidationContext,
  ValidationRule,
} from 'graphql';
import type { ApolloServerPlugin, BaseContext } from '@apollo/server';
import { ErrorCode } from '../common/errors/error-codes';

export const GRAPHQL_OPERATION_REJECTED = ErrorCode.GRAPHQL_OPERATION_REJECTED;

/**
 * These limits leave substantial headroom over the committed application
 * operations (depth 4, aliases 0, cost 123, tokens 110) and GraphQL's standard
 * introspection query (depth 15, cost 1745, tokens 160).
 */
export const GRAPHQL_OPERATION_LIMITS = Object.freeze({
  maxDepth: 16,
  maxAliases: 30,
  maxCost: 2_500,
  maxTokens: 2_000,
});

const OPERATION_LIMIT_MARKER = 'oasisOperationLimit';
const OPERATION_REJECTED_MESSAGE = 'GraphQL operation rejected';
const TOKEN_LIMIT_MESSAGE =
  /^(?:Syntax Error: )?Document contains more tha(?:n|t) \d+ tokens\. Parsing aborted\.$/;
const GRAPHQL_PARSE_FAILED = 'GRAPHQL_PARSE_FAILED';

interface OperationLimits {
  maxDepth: number;
  maxAliases: number;
  maxCost: number;
}

interface OperationMetrics {
  aliases: number;
  cost: number;
  depth: number;
}

const EMPTY_METRICS: OperationMetrics = {
  aliases: 0,
  cost: 0,
  depth: 0,
};

export function createGraphQLOperationGuardRule(
  limits: OperationLimits = GRAPHQL_OPERATION_LIMITS,
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    Document(document: DocumentNode) {
      const fragments = new Map<string, FragmentDefinitionNode>();

      for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          fragments.set(definition.name.value, definition);
        }
      }

      for (const definition of document.definitions) {
        if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

        const metrics = measureOperation(definition, fragments);
        if (
          metrics.depth > limits.maxDepth ||
          metrics.aliases > limits.maxAliases ||
          metrics.cost > limits.maxCost
        ) {
          context.reportError(operationRejectedError(definition));
          break;
        }
      }
    },
  });
}

export function isGraphQLOperationLimitError(
  formattedError: { message?: string; extensions?: Record<string, unknown> },
  originalError?: unknown,
): boolean {
  if (formattedError.extensions?.[OPERATION_LIMIT_MARKER] === true) {
    return true;
  }

  let hasParserPhaseEvidence =
    formattedError.extensions?.code === GRAPHQL_PARSE_FAILED;
  let hasNativeTokenLimitMessage =
    typeof formattedError.message === 'string' &&
    TOKEN_LIMIT_MESSAGE.test(formattedError.message);
  let candidate = originalError;
  const visited = new Set<unknown>();

  while (candidate && !visited.has(candidate)) {
    visited.add(candidate);
    if (typeof candidate !== 'object') return false;

    const error = candidate as {
      message?: unknown;
      extensions?: Record<string, unknown>;
      originalError?: unknown;
    };
    if (error.extensions?.[OPERATION_LIMIT_MARKER] === true) return true;
    if (error.extensions?.code === GRAPHQL_PARSE_FAILED) {
      hasParserPhaseEvidence = true;
    }
    if (
      typeof error.message === 'string' &&
      TOKEN_LIMIT_MESSAGE.test(error.message)
    ) {
      hasNativeTokenLimitMessage = true;
    }
    candidate = error.originalError;
  }

  return hasParserPhaseEvidence && hasNativeTokenLimitMessage;
}

/**
 * GraphQL runs all validation rules and can therefore produce schema errors in
 * addition to the operation-limit marker. Collapse only limit rejections at
 * the final HTTP response boundary; ordinary parse, validation, and execution
 * errors retain Apollo's normal behavior.
 */
export function createGraphQLOperationGuardPlugin(): ApolloServerPlugin<BaseContext> {
  return {
    async requestDidStart() {
      return {
        async willSendResponse(requestContext) {
          if (
            !requestContext.errors?.some((error) =>
              isGraphQLOperationLimitError(error, error),
            )
          ) {
            return;
          }

          requestContext.response.http.status = 400;
          requestContext.response.body = {
            kind: 'single',
            singleResult: {
              errors: [graphQLOperationRejectedError().toJSON()],
            },
          };
        },
      };
    },
  };
}

export function graphQLOperationRejectedError(): GraphQLError {
  return new GraphQLError(OPERATION_REJECTED_MESSAGE, {
    extensions: { code: GRAPHQL_OPERATION_REJECTED },
  });
}

function operationRejectedError(
  operation: OperationDefinitionNode,
): GraphQLError {
  return new GraphQLError(OPERATION_REJECTED_MESSAGE, {
    nodes: operation,
    extensions: {
      [OPERATION_LIMIT_MARKER]: true,
    },
  });
}

function measureOperation(
  operation: OperationDefinitionNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
): OperationMetrics {
  return measureSelectionSet(
    operation.selectionSet,
    1,
    fragments,
    new Set<string>(),
    new Map<string, OperationMetrics>(),
  );
}

function measureSelectionSet(
  selectionSet: SelectionSetNode,
  fieldDepth: number,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  activeFragments: ReadonlySet<string>,
  fragmentCache: Map<string, OperationMetrics>,
): OperationMetrics {
  let aliases = 0;
  let cost = 0;
  let depth = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      aliases += selection.alias ? 1 : 0;
      // A field contributes its current depth, bounding both broad and deeply
      // nested operations without relying on resolver-specific internals.
      cost += fieldDepth;
      depth = Math.max(depth, fieldDepth);

      if (selection.selectionSet) {
        const nested = measureSelectionSet(
          selection.selectionSet,
          fieldDepth + 1,
          fragments,
          activeFragments,
          fragmentCache,
        );
        aliases += nested.aliases;
        cost += nested.cost;
        depth = Math.max(depth, nested.depth);
      }
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const nested = measureSelectionSet(
        selection.selectionSet,
        fieldDepth,
        fragments,
        activeFragments,
        fragmentCache,
      );
      aliases += nested.aliases;
      cost += nested.cost;
      depth = Math.max(depth, nested.depth);
      continue;
    }

    const fragmentName = selection.name.value;
    const fragment = fragments.get(fragmentName);
    if (!fragment || activeFragments.has(fragmentName)) continue;

    const cacheKey = `${fragmentName}:${fieldDepth}`;
    let nested = fragmentCache.get(cacheKey);
    if (!nested) {
      const nextActiveFragments = new Set(activeFragments);
      nextActiveFragments.add(fragmentName);
      nested = measureSelectionSet(
        fragment.selectionSet,
        fieldDepth,
        fragments,
        nextActiveFragments,
        fragmentCache,
      );
      fragmentCache.set(cacheKey, nested);
    }

    aliases += nested.aliases;
    cost += nested.cost;
    depth = Math.max(depth, nested.depth);
  }

  return depth === 0 ? EMPTY_METRICS : { aliases, cost, depth };
}
