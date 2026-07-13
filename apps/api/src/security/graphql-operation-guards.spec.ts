import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { INestApplication, Module } from '@nestjs/common';
import {
  Field,
  GraphQLModule,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { buildSchema, getIntrospectionQuery, parse, validate } from 'graphql';
import request from 'supertest';
import { formatGraphQLError } from '../common/filters/graphql-error.filter';
import { getGraphQLSecurityOptions } from './api-hardening';
import {
  createGraphQLOperationGuardRule,
  GRAPHQL_OPERATION_LIMITS,
  GRAPHQL_OPERATION_REJECTED,
} from './graphql-operation-guards';

@ObjectType()
class GuardNode {
  @Field()
  value!: string;

  @Field(() => GuardNode, { nullable: true })
  child?: GuardNode;
}

@Resolver()
class GuardResolver {
  calls = 0;

  @Query(() => GuardNode)
  guardRoot(): GuardNode {
    this.calls += 1;
    return {
      value: 'ok',
      child: { value: 'nested' },
    };
  }
}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      ...getGraphQLSecurityOptions('test'),
      formatError: formatGraphQLError,
    }),
  ],
  providers: [GuardResolver],
})
class GuardTestModule {}

const metricSchema = buildSchema(`
  type Node {
    child: Node
    value: String
  }

  type Query {
    root: Node
  }
`);

function guardErrors(
  source: string,
  limits: { maxDepth: number; maxAliases: number; maxCost: number },
) {
  return validate(metricSchema, parse(source), [
    createGraphQLOperationGuardRule(limits),
  ]);
}

describe('GraphQL operation guards', () => {
  let app: INestApplication;
  let resolver: GuardResolver;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GuardTestModule],
    }).compile();
    resolver = moduleRef.get(GuardResolver);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resolver.calls = 0;
  });

  it('accepts representative operations and standard development introspection', async () => {
    const introspectionErrors = validate(
      metricSchema,
      parse(getIntrospectionQuery(), {
        maxTokens: GRAPHQL_OPERATION_LIMITS.maxTokens,
      }),
      [createGraphQLOperationGuardRule()],
    );
    expect(introspectionErrors).toEqual([]);

    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query RepresentativeOperation {
            guardRoot {
              value
              child {
                value
              }
            }
          }
        `,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.errors).toBeUndefined();
        expect(body.data.guardRoot.value).toBe('ok');
      });
    expect(resolver.calls).toBe(1);
  });

  it.each([
    {
      name: 'fragment-expanded depth',
      source: `
        query DeepOperation { root { ...DeepFields } }
        fragment DeepFields on Node { child { child { value } } }
      `,
      limits: { maxDepth: 3, maxAliases: 30, maxCost: 2_500 },
    },
    {
      name: 'fragment-expanded aliases',
      source: `
        query AliasedOperation { root { ...AliasedFields } }
        fragment AliasedFields on Node { first: value second: value }
      `,
      limits: { maxDepth: 16, maxAliases: 1, maxCost: 2_500 },
    },
    {
      name: 'fragment-expanded cost',
      source: `
        query CostlyOperation { root { ...CostlyFields } }
        fragment CostlyFields on Node { value child { value } }
      `,
      limits: { maxDepth: 16, maxAliases: 30, maxCost: 5 },
    },
  ])(
    'rejects $name with one generic validation error',
    ({ source, limits }) => {
      const errors = guardErrors(source, limits);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('GraphQL operation rejected');
      expect(errors[0].message).not.toMatch(/depth|alias|cost|limit/i);
    },
  );

  it('accepts an operation exactly at the configured validation boundaries', () => {
    const errors = guardErrors(
      `
        query BoundaryOperation {
          root {
            first: value
            child { value }
          }
        }
      `,
      { maxDepth: 3, maxAliases: 1, maxCost: 8 },
    );

    expect(errors).toEqual([]);
  });

  it('terminates safely on cyclic fragments while standard validation rejects the cycle', () => {
    const document = parse(`
      query CyclicOperation { root { ...CycleA } }
      fragment CycleA on Node { ...CycleB }
      fragment CycleB on Node { ...CycleA }
    `);

    expect(() =>
      validate(metricSchema, document, [createGraphQLOperationGuardRule()]),
    ).not.toThrow();
    expect(
      validate(metricSchema, document).some(({ message }) =>
        message.includes('Cannot spread fragment'),
      ),
    ).toBe(true);
  });

  it.each([
    {
      name: 'alias boundary',
      query: `query AliasBoundary { ${Array.from(
        { length: GRAPHQL_OPERATION_LIMITS.maxAliases + 1 },
        (_, index) => `alias${index}: guardRoot { value }`,
      ).join('\n')} }`,
    },
    {
      name: 'depth boundary',
      query: `query DepthBoundary { guardRoot { ${'child { '.repeat(
        GRAPHQL_OPERATION_LIMITS.maxDepth - 1,
      )}value${' }'.repeat(GRAPHQL_OPERATION_LIMITS.maxDepth - 1)} } }`,
    },
    {
      name: 'token boundary',
      query: `query TokenBoundary { ${'guardRoot { value } '.repeat(700)} }`,
    },
  ])(
    'rejects the $name before resolver execution with the stable response',
    async ({ query }) => {
      await request(app.getHttpServer())
        .post('/graphql')
        .send({ query })
        .expect(400)
        .expect(({ body }) => {
          expect(body.errors).toHaveLength(1);
          expect(body.errors[0]).toEqual({
            message: 'GraphQL operation rejected',
            extensions: { code: GRAPHQL_OPERATION_REJECTED },
          });
          expect(JSON.stringify(body)).not.toMatch(
            /depth|alias|token|cost|limit/i,
          );
        });
      expect(resolver.calls).toBe(0);
    },
  );

  it('returns only the stable rejection for a mixed over-limit and invalid document', async () => {
    const query = `query MixedInvalidBoundary {
      ${Array.from(
        { length: GRAPHQL_OPERATION_LIMITS.maxAliases + 1 },
        (_, index) => `alias${index}: guardRoot { value }`,
      ).join('\n')}
      schemaHintProbe
    }`;

    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          errors: [
            {
              message: 'GraphQL operation rejected',
              extensions: { code: GRAPHQL_OPERATION_REJECTED },
            },
          ],
        });
        expect(JSON.stringify(body)).not.toContain('schemaHintProbe');
        expect(JSON.stringify(body)).not.toMatch(
          /Cannot query field|Did you mean/,
        );
      });
    expect(resolver.calls).toBe(0);
  });

  it('preserves ordinary Apollo validation errors for within-limit documents', async () => {
    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'query InvalidWithinLimit { schemaHintProbe }' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0].message).toContain(
          'Cannot query field "schemaHintProbe"',
        );
        expect(body.errors[0].extensions.code).toBe(
          'GRAPHQL_VALIDATION_FAILED',
        );
      });
    expect(resolver.calls).toBe(0);
  });
});
