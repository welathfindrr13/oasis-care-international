
/**
 * Client
**/

import * as runtime from './runtime/library';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Carer
 * 
 */
export type Carer = $Result.DefaultSelection<Prisma.$CarerPayload>
/**
 * Model Client
 * 
 */
export type Client = $Result.DefaultSelection<Prisma.$ClientPayload>
/**
 * Model Visit
 * 
 */
export type Visit = $Result.DefaultSelection<Prisma.$VisitPayload>
/**
 * Model VisitTask
 * 
 */
export type VisitTask = $Result.DefaultSelection<Prisma.$VisitTaskPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const VisitStatus: {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus]

}

export type VisitStatus = $Enums.VisitStatus

export const VisitStatus: typeof $Enums.VisitStatus

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Carers
 * const carers = await prisma.carer.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<T['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Carers
   * const carers = await prisma.carer.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<T, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<'extends', Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.carer`: Exposes CRUD operations for the **Carer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Carers
    * const carers = await prisma.carer.findMany()
    * ```
    */
  get carer(): Prisma.CarerDelegate<ExtArgs>;

  /**
   * `prisma.client`: Exposes CRUD operations for the **Client** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Clients
    * const clients = await prisma.client.findMany()
    * ```
    */
  get client(): Prisma.ClientDelegate<ExtArgs>;

  /**
   * `prisma.visit`: Exposes CRUD operations for the **Visit** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Visits
    * const visits = await prisma.visit.findMany()
    * ```
    */
  get visit(): Prisma.VisitDelegate<ExtArgs>;

  /**
   * `prisma.visitTask`: Exposes CRUD operations for the **VisitTask** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more VisitTasks
    * const visitTasks = await prisma.visitTask.findMany()
    * ```
    */
  get visitTask(): Prisma.VisitTaskDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.8.0
   * Query Engine version: 0a83d8541752d7582de2ebc1ece46519ce72a848
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON object.
   * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
   */
  export type JsonObject = {[Key in string]?: JsonValue}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON array.
   */
  export interface JsonArray extends Array<JsonValue> {}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches any valid JSON value.
   */
  export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

  /**
   * Matches a JSON object.
   * Unlike `JsonObject`, this type allows undefined and read-only properties.
   */
  export type InputJsonObject = {readonly [Key in string]?: InputJsonValue | null}

  /**
   * Matches a JSON array.
   * Unlike `JsonArray`, readonly arrays are assignable to this type.
   */
  export interface InputJsonArray extends ReadonlyArray<InputJsonValue | null> {}

  /**
   * Matches any valid value that can be used as an input for operations like
   * create and update as the value of a JSON field. Unlike `JsonValue`, this
   * type allows read-only arrays and read-only object properties and disallows
   * `null` at the top level.
   *
   * `null` cannot be used as the value of a JSON field because its meaning
   * would be ambiguous. Use `Prisma.JsonNull` to store the JSON null value or
   * `Prisma.DbNull` to clear the JSON value and set the field to the database
   * NULL value instead.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
   */
  export type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray | { toJSON(): unknown }

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Carer: 'Carer',
    Client: 'Client',
    Visit: 'Visit',
    VisitTask: 'VisitTask'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }


  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs}, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    meta: {
      modelProps: 'carer' | 'client' | 'visit' | 'visitTask'
      txIsolationLevel: Prisma.TransactionIsolationLevel
    },
    model: {
      Carer: {
        payload: Prisma.$CarerPayload<ExtArgs>
        fields: Prisma.CarerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CarerFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CarerFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          findFirst: {
            args: Prisma.CarerFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CarerFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          findMany: {
            args: Prisma.CarerFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>[]
          }
          create: {
            args: Prisma.CarerCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          createMany: {
            args: Prisma.CarerCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.CarerDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          update: {
            args: Prisma.CarerUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          deleteMany: {
            args: Prisma.CarerDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.CarerUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.CarerUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$CarerPayload>
          }
          aggregate: {
            args: Prisma.CarerAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateCarer>
          }
          groupBy: {
            args: Prisma.CarerGroupByArgs<ExtArgs>,
            result: $Utils.Optional<CarerGroupByOutputType>[]
          }
          count: {
            args: Prisma.CarerCountArgs<ExtArgs>,
            result: $Utils.Optional<CarerCountAggregateOutputType> | number
          }
        }
      }
      Client: {
        payload: Prisma.$ClientPayload<ExtArgs>
        fields: Prisma.ClientFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClientFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClientFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          findFirst: {
            args: Prisma.ClientFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClientFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          findMany: {
            args: Prisma.ClientFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>[]
          }
          create: {
            args: Prisma.ClientCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          createMany: {
            args: Prisma.ClientCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.ClientDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          update: {
            args: Prisma.ClientUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          deleteMany: {
            args: Prisma.ClientDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.ClientUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.ClientUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$ClientPayload>
          }
          aggregate: {
            args: Prisma.ClientAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateClient>
          }
          groupBy: {
            args: Prisma.ClientGroupByArgs<ExtArgs>,
            result: $Utils.Optional<ClientGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClientCountArgs<ExtArgs>,
            result: $Utils.Optional<ClientCountAggregateOutputType> | number
          }
        }
      }
      Visit: {
        payload: Prisma.$VisitPayload<ExtArgs>
        fields: Prisma.VisitFieldRefs
        operations: {
          findUnique: {
            args: Prisma.VisitFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.VisitFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          findFirst: {
            args: Prisma.VisitFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.VisitFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          findMany: {
            args: Prisma.VisitFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>[]
          }
          create: {
            args: Prisma.VisitCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          createMany: {
            args: Prisma.VisitCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.VisitDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          update: {
            args: Prisma.VisitUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          deleteMany: {
            args: Prisma.VisitDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.VisitUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.VisitUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitPayload>
          }
          aggregate: {
            args: Prisma.VisitAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateVisit>
          }
          groupBy: {
            args: Prisma.VisitGroupByArgs<ExtArgs>,
            result: $Utils.Optional<VisitGroupByOutputType>[]
          }
          count: {
            args: Prisma.VisitCountArgs<ExtArgs>,
            result: $Utils.Optional<VisitCountAggregateOutputType> | number
          }
        }
      }
      VisitTask: {
        payload: Prisma.$VisitTaskPayload<ExtArgs>
        fields: Prisma.VisitTaskFieldRefs
        operations: {
          findUnique: {
            args: Prisma.VisitTaskFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.VisitTaskFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          findFirst: {
            args: Prisma.VisitTaskFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.VisitTaskFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          findMany: {
            args: Prisma.VisitTaskFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>[]
          }
          create: {
            args: Prisma.VisitTaskCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          createMany: {
            args: Prisma.VisitTaskCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.VisitTaskDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          update: {
            args: Prisma.VisitTaskUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          deleteMany: {
            args: Prisma.VisitTaskDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.VisitTaskUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.VisitTaskUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<Prisma.$VisitTaskPayload>
          }
          aggregate: {
            args: Prisma.VisitTaskAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateVisitTask>
          }
          groupBy: {
            args: Prisma.VisitTaskGroupByArgs<ExtArgs>,
            result: $Utils.Optional<VisitTaskGroupByOutputType>[]
          }
          count: {
            args: Prisma.VisitTaskCountArgs<ExtArgs>,
            result: $Utils.Optional<VisitTaskCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<'define', Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type CarerCountOutputType
   */

  export type CarerCountOutputType = {
    visits: number
  }

  export type CarerCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    visits?: boolean | CarerCountOutputTypeCountVisitsArgs
  }

  // Custom InputTypes

  /**
   * CarerCountOutputType without action
   */
  export type CarerCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CarerCountOutputType
     */
    select?: CarerCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * CarerCountOutputType without action
   */
  export type CarerCountOutputTypeCountVisitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VisitWhereInput
  }



  /**
   * Count Type ClientCountOutputType
   */

  export type ClientCountOutputType = {
    visits: number
  }

  export type ClientCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    visits?: boolean | ClientCountOutputTypeCountVisitsArgs
  }

  // Custom InputTypes

  /**
   * ClientCountOutputType without action
   */
  export type ClientCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientCountOutputType
     */
    select?: ClientCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * ClientCountOutputType without action
   */
  export type ClientCountOutputTypeCountVisitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VisitWhereInput
  }



  /**
   * Count Type VisitCountOutputType
   */

  export type VisitCountOutputType = {
    tasks: number
  }

  export type VisitCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tasks?: boolean | VisitCountOutputTypeCountTasksArgs
  }

  // Custom InputTypes

  /**
   * VisitCountOutputType without action
   */
  export type VisitCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitCountOutputType
     */
    select?: VisitCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * VisitCountOutputType without action
   */
  export type VisitCountOutputTypeCountTasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VisitTaskWhereInput
  }



  /**
   * Models
   */

  /**
   * Model Carer
   */

  export type AggregateCarer = {
    _count: CarerCountAggregateOutputType | null
    _min: CarerMinAggregateOutputType | null
    _max: CarerMaxAggregateOutputType | null
  }

  export type CarerMinAggregateOutputType = {
    id: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    hire_date: Date | null
    is_active: boolean | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type CarerMaxAggregateOutputType = {
    id: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    hire_date: Date | null
    is_active: boolean | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type CarerCountAggregateOutputType = {
    id: number
    first_name: number
    last_name: number
    email: number
    phone: number
    hire_date: number
    is_active: number
    created_at: number
    updated_at: number
    deleted_at: number
    _all: number
  }


  export type CarerMinAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    phone?: true
    hire_date?: true
    is_active?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type CarerMaxAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    phone?: true
    hire_date?: true
    is_active?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type CarerCountAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    phone?: true
    hire_date?: true
    is_active?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
    _all?: true
  }

  export type CarerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Carer to aggregate.
     */
    where?: CarerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carers to fetch.
     */
    orderBy?: CarerOrderByWithRelationInput | CarerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CarerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Carers
    **/
    _count?: true | CarerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CarerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CarerMaxAggregateInputType
  }

  export type GetCarerAggregateType<T extends CarerAggregateArgs> = {
        [P in keyof T & keyof AggregateCarer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCarer[P]>
      : GetScalarType<T[P], AggregateCarer[P]>
  }




  export type CarerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CarerWhereInput
    orderBy?: CarerOrderByWithAggregationInput | CarerOrderByWithAggregationInput[]
    by: CarerScalarFieldEnum[] | CarerScalarFieldEnum
    having?: CarerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CarerCountAggregateInputType | true
    _min?: CarerMinAggregateInputType
    _max?: CarerMaxAggregateInputType
  }

  export type CarerGroupByOutputType = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    hire_date: Date
    is_active: boolean
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    _count: CarerCountAggregateOutputType | null
    _min: CarerMinAggregateOutputType | null
    _max: CarerMaxAggregateOutputType | null
  }

  type GetCarerGroupByPayload<T extends CarerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CarerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CarerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CarerGroupByOutputType[P]>
            : GetScalarType<T[P], CarerGroupByOutputType[P]>
        }
      >
    >


  export type CarerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    phone?: boolean
    hire_date?: boolean
    is_active?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
    visits?: boolean | Carer$visitsArgs<ExtArgs>
    _count?: boolean | CarerCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["carer"]>

  export type CarerSelectScalar = {
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    phone?: boolean
    hire_date?: boolean
    is_active?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
  }

  export type CarerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    visits?: boolean | Carer$visitsArgs<ExtArgs>
    _count?: boolean | CarerCountOutputTypeDefaultArgs<ExtArgs>
  }


  export type $CarerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Carer"
    objects: {
      visits: Prisma.$VisitPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
      hire_date: Date
      is_active: boolean
      created_at: Date
      updated_at: Date
      deleted_at: Date | null
    }, ExtArgs["result"]["carer"]>
    composites: {}
  }


  type CarerGetPayload<S extends boolean | null | undefined | CarerDefaultArgs> = $Result.GetResult<Prisma.$CarerPayload, S>

  type CarerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<CarerFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: CarerCountAggregateInputType | true
    }

  export interface CarerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Carer'], meta: { name: 'Carer' } }
    /**
     * Find zero or one Carer that matches the filter.
     * @param {CarerFindUniqueArgs} args - Arguments to find a Carer
     * @example
     * // Get one Carer
     * const carer = await prisma.carer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends CarerFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, CarerFindUniqueArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Carer that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {CarerFindUniqueOrThrowArgs} args - Arguments to find a Carer
     * @example
     * // Get one Carer
     * const carer = await prisma.carer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends CarerFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Carer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerFindFirstArgs} args - Arguments to find a Carer
     * @example
     * // Get one Carer
     * const carer = await prisma.carer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends CarerFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerFindFirstArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Carer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerFindFirstOrThrowArgs} args - Arguments to find a Carer
     * @example
     * // Get one Carer
     * const carer = await prisma.carer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends CarerFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Carers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Carers
     * const carers = await prisma.carer.findMany()
     * 
     * // Get first 10 Carers
     * const carers = await prisma.carer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const carerWithIdOnly = await prisma.carer.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends CarerFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Carer.
     * @param {CarerCreateArgs} args - Arguments to create a Carer.
     * @example
     * // Create one Carer
     * const Carer = await prisma.carer.create({
     *   data: {
     *     // ... data to create a Carer
     *   }
     * })
     * 
    **/
    create<T extends CarerCreateArgs<ExtArgs>>(
      args: SelectSubset<T, CarerCreateArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Carers.
     *     @param {CarerCreateManyArgs} args - Arguments to create many Carers.
     *     @example
     *     // Create many Carers
     *     const carer = await prisma.carer.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends CarerCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Carer.
     * @param {CarerDeleteArgs} args - Arguments to delete one Carer.
     * @example
     * // Delete one Carer
     * const Carer = await prisma.carer.delete({
     *   where: {
     *     // ... filter to delete one Carer
     *   }
     * })
     * 
    **/
    delete<T extends CarerDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, CarerDeleteArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Carer.
     * @param {CarerUpdateArgs} args - Arguments to update one Carer.
     * @example
     * // Update one Carer
     * const carer = await prisma.carer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends CarerUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, CarerUpdateArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Carers.
     * @param {CarerDeleteManyArgs} args - Arguments to filter Carers to delete.
     * @example
     * // Delete a few Carers
     * const { count } = await prisma.carer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends CarerDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CarerDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Carers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Carers
     * const carer = await prisma.carer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends CarerUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, CarerUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Carer.
     * @param {CarerUpsertArgs} args - Arguments to update or create a Carer.
     * @example
     * // Update or create a Carer
     * const carer = await prisma.carer.upsert({
     *   create: {
     *     // ... data to create a Carer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Carer we want to update
     *   }
     * })
    **/
    upsert<T extends CarerUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, CarerUpsertArgs<ExtArgs>>
    ): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Carers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerCountArgs} args - Arguments to filter Carers to count.
     * @example
     * // Count the number of Carers
     * const count = await prisma.carer.count({
     *   where: {
     *     // ... the filter for the Carers we want to count
     *   }
     * })
    **/
    count<T extends CarerCountArgs>(
      args?: Subset<T, CarerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CarerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Carer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CarerAggregateArgs>(args: Subset<T, CarerAggregateArgs>): Prisma.PrismaPromise<GetCarerAggregateType<T>>

    /**
     * Group by Carer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CarerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CarerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CarerGroupByArgs['orderBy'] }
        : { orderBy?: CarerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CarerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCarerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Carer model
   */
  readonly fields: CarerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Carer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CarerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';

    visits<T extends Carer$visitsArgs<ExtArgs> = {}>(args?: Subset<T, Carer$visitsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findMany'> | Null>;

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }



  /**
   * Fields of the Carer model
   */ 
  interface CarerFieldRefs {
    readonly id: FieldRef<"Carer", 'String'>
    readonly first_name: FieldRef<"Carer", 'String'>
    readonly last_name: FieldRef<"Carer", 'String'>
    readonly email: FieldRef<"Carer", 'String'>
    readonly phone: FieldRef<"Carer", 'String'>
    readonly hire_date: FieldRef<"Carer", 'DateTime'>
    readonly is_active: FieldRef<"Carer", 'Boolean'>
    readonly created_at: FieldRef<"Carer", 'DateTime'>
    readonly updated_at: FieldRef<"Carer", 'DateTime'>
    readonly deleted_at: FieldRef<"Carer", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Carer findUnique
   */
  export type CarerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter, which Carer to fetch.
     */
    where: CarerWhereUniqueInput
  }


  /**
   * Carer findUniqueOrThrow
   */
  export type CarerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter, which Carer to fetch.
     */
    where: CarerWhereUniqueInput
  }


  /**
   * Carer findFirst
   */
  export type CarerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter, which Carer to fetch.
     */
    where?: CarerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carers to fetch.
     */
    orderBy?: CarerOrderByWithRelationInput | CarerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Carers.
     */
    cursor?: CarerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Carers.
     */
    distinct?: CarerScalarFieldEnum | CarerScalarFieldEnum[]
  }


  /**
   * Carer findFirstOrThrow
   */
  export type CarerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter, which Carer to fetch.
     */
    where?: CarerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carers to fetch.
     */
    orderBy?: CarerOrderByWithRelationInput | CarerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Carers.
     */
    cursor?: CarerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Carers.
     */
    distinct?: CarerScalarFieldEnum | CarerScalarFieldEnum[]
  }


  /**
   * Carer findMany
   */
  export type CarerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter, which Carers to fetch.
     */
    where?: CarerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carers to fetch.
     */
    orderBy?: CarerOrderByWithRelationInput | CarerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Carers.
     */
    cursor?: CarerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carers.
     */
    skip?: number
    distinct?: CarerScalarFieldEnum | CarerScalarFieldEnum[]
  }


  /**
   * Carer create
   */
  export type CarerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * The data needed to create a Carer.
     */
    data: XOR<CarerCreateInput, CarerUncheckedCreateInput>
  }


  /**
   * Carer createMany
   */
  export type CarerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Carers.
     */
    data: CarerCreateManyInput | CarerCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Carer update
   */
  export type CarerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * The data needed to update a Carer.
     */
    data: XOR<CarerUpdateInput, CarerUncheckedUpdateInput>
    /**
     * Choose, which Carer to update.
     */
    where: CarerWhereUniqueInput
  }


  /**
   * Carer updateMany
   */
  export type CarerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Carers.
     */
    data: XOR<CarerUpdateManyMutationInput, CarerUncheckedUpdateManyInput>
    /**
     * Filter which Carers to update
     */
    where?: CarerWhereInput
  }


  /**
   * Carer upsert
   */
  export type CarerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * The filter to search for the Carer to update in case it exists.
     */
    where: CarerWhereUniqueInput
    /**
     * In case the Carer found by the `where` argument doesn't exist, create a new Carer with this data.
     */
    create: XOR<CarerCreateInput, CarerUncheckedCreateInput>
    /**
     * In case the Carer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CarerUpdateInput, CarerUncheckedUpdateInput>
  }


  /**
   * Carer delete
   */
  export type CarerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
    /**
     * Filter which Carer to delete.
     */
    where: CarerWhereUniqueInput
  }


  /**
   * Carer deleteMany
   */
  export type CarerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Carers to delete
     */
    where?: CarerWhereInput
  }


  /**
   * Carer.visits
   */
  export type Carer$visitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    where?: VisitWhereInput
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    cursor?: VisitWhereUniqueInput
    take?: number
    skip?: number
    distinct?: VisitScalarFieldEnum | VisitScalarFieldEnum[]
  }


  /**
   * Carer without action
   */
  export type CarerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Carer
     */
    select?: CarerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CarerInclude<ExtArgs> | null
  }



  /**
   * Model Client
   */

  export type AggregateClient = {
    _count: ClientCountAggregateOutputType | null
    _min: ClientMinAggregateOutputType | null
    _max: ClientMaxAggregateOutputType | null
  }

  export type ClientMinAggregateOutputType = {
    id: string | null
    full_name: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    postcode: string | null
    date_of_birth: Date | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type ClientMaxAggregateOutputType = {
    id: string | null
    full_name: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    postcode: string | null
    date_of_birth: Date | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type ClientCountAggregateOutputType = {
    id: number
    full_name: number
    address_line1: number
    address_line2: number
    city: number
    postcode: number
    date_of_birth: number
    created_at: number
    updated_at: number
    deleted_at: number
    _all: number
  }


  export type ClientMinAggregateInputType = {
    id?: true
    full_name?: true
    address_line1?: true
    address_line2?: true
    city?: true
    postcode?: true
    date_of_birth?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type ClientMaxAggregateInputType = {
    id?: true
    full_name?: true
    address_line1?: true
    address_line2?: true
    city?: true
    postcode?: true
    date_of_birth?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type ClientCountAggregateInputType = {
    id?: true
    full_name?: true
    address_line1?: true
    address_line2?: true
    city?: true
    postcode?: true
    date_of_birth?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
    _all?: true
  }

  export type ClientAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Client to aggregate.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Clients
    **/
    _count?: true | ClientCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClientMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClientMaxAggregateInputType
  }

  export type GetClientAggregateType<T extends ClientAggregateArgs> = {
        [P in keyof T & keyof AggregateClient]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClient[P]>
      : GetScalarType<T[P], AggregateClient[P]>
  }




  export type ClientGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClientWhereInput
    orderBy?: ClientOrderByWithAggregationInput | ClientOrderByWithAggregationInput[]
    by: ClientScalarFieldEnum[] | ClientScalarFieldEnum
    having?: ClientScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClientCountAggregateInputType | true
    _min?: ClientMinAggregateInputType
    _max?: ClientMaxAggregateInputType
  }

  export type ClientGroupByOutputType = {
    id: string
    full_name: string
    address_line1: string
    address_line2: string | null
    city: string
    postcode: string
    date_of_birth: Date | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    _count: ClientCountAggregateOutputType | null
    _min: ClientMinAggregateOutputType | null
    _max: ClientMaxAggregateOutputType | null
  }

  type GetClientGroupByPayload<T extends ClientGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClientGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClientGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClientGroupByOutputType[P]>
            : GetScalarType<T[P], ClientGroupByOutputType[P]>
        }
      >
    >


  export type ClientSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    full_name?: boolean
    address_line1?: boolean
    address_line2?: boolean
    city?: boolean
    postcode?: boolean
    date_of_birth?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
    visits?: boolean | Client$visitsArgs<ExtArgs>
    _count?: boolean | ClientCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["client"]>

  export type ClientSelectScalar = {
    id?: boolean
    full_name?: boolean
    address_line1?: boolean
    address_line2?: boolean
    city?: boolean
    postcode?: boolean
    date_of_birth?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
  }

  export type ClientInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    visits?: boolean | Client$visitsArgs<ExtArgs>
    _count?: boolean | ClientCountOutputTypeDefaultArgs<ExtArgs>
  }


  export type $ClientPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Client"
    objects: {
      visits: Prisma.$VisitPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      full_name: string
      address_line1: string
      address_line2: string | null
      city: string
      postcode: string
      date_of_birth: Date | null
      created_at: Date
      updated_at: Date
      deleted_at: Date | null
    }, ExtArgs["result"]["client"]>
    composites: {}
  }


  type ClientGetPayload<S extends boolean | null | undefined | ClientDefaultArgs> = $Result.GetResult<Prisma.$ClientPayload, S>

  type ClientCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClientFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClientCountAggregateInputType | true
    }

  export interface ClientDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Client'], meta: { name: 'Client' } }
    /**
     * Find zero or one Client that matches the filter.
     * @param {ClientFindUniqueArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends ClientFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, ClientFindUniqueArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Client that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {ClientFindUniqueOrThrowArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends ClientFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Client that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindFirstArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends ClientFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindFirstArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Client that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindFirstOrThrowArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends ClientFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Clients that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Clients
     * const clients = await prisma.client.findMany()
     * 
     * // Get first 10 Clients
     * const clients = await prisma.client.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clientWithIdOnly = await prisma.client.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends ClientFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Client.
     * @param {ClientCreateArgs} args - Arguments to create a Client.
     * @example
     * // Create one Client
     * const Client = await prisma.client.create({
     *   data: {
     *     // ... data to create a Client
     *   }
     * })
     * 
    **/
    create<T extends ClientCreateArgs<ExtArgs>>(
      args: SelectSubset<T, ClientCreateArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Clients.
     *     @param {ClientCreateManyArgs} args - Arguments to create many Clients.
     *     @example
     *     // Create many Clients
     *     const client = await prisma.client.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends ClientCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Client.
     * @param {ClientDeleteArgs} args - Arguments to delete one Client.
     * @example
     * // Delete one Client
     * const Client = await prisma.client.delete({
     *   where: {
     *     // ... filter to delete one Client
     *   }
     * })
     * 
    **/
    delete<T extends ClientDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, ClientDeleteArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Client.
     * @param {ClientUpdateArgs} args - Arguments to update one Client.
     * @example
     * // Update one Client
     * const client = await prisma.client.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends ClientUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpdateArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Clients.
     * @param {ClientDeleteManyArgs} args - Arguments to filter Clients to delete.
     * @example
     * // Delete a few Clients
     * const { count } = await prisma.client.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends ClientDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Clients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Clients
     * const client = await prisma.client.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends ClientUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Client.
     * @param {ClientUpsertArgs} args - Arguments to update or create a Client.
     * @example
     * // Update or create a Client
     * const client = await prisma.client.upsert({
     *   create: {
     *     // ... data to create a Client
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Client we want to update
     *   }
     * })
    **/
    upsert<T extends ClientUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpsertArgs<ExtArgs>>
    ): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Clients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientCountArgs} args - Arguments to filter Clients to count.
     * @example
     * // Count the number of Clients
     * const count = await prisma.client.count({
     *   where: {
     *     // ... the filter for the Clients we want to count
     *   }
     * })
    **/
    count<T extends ClientCountArgs>(
      args?: Subset<T, ClientCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClientCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Client.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClientAggregateArgs>(args: Subset<T, ClientAggregateArgs>): Prisma.PrismaPromise<GetClientAggregateType<T>>

    /**
     * Group by Client.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClientGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClientGroupByArgs['orderBy'] }
        : { orderBy?: ClientGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClientGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClientGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Client model
   */
  readonly fields: ClientFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Client.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClientClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';

    visits<T extends Client$visitsArgs<ExtArgs> = {}>(args?: Subset<T, Client$visitsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findMany'> | Null>;

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }



  /**
   * Fields of the Client model
   */ 
  interface ClientFieldRefs {
    readonly id: FieldRef<"Client", 'String'>
    readonly full_name: FieldRef<"Client", 'String'>
    readonly address_line1: FieldRef<"Client", 'String'>
    readonly address_line2: FieldRef<"Client", 'String'>
    readonly city: FieldRef<"Client", 'String'>
    readonly postcode: FieldRef<"Client", 'String'>
    readonly date_of_birth: FieldRef<"Client", 'DateTime'>
    readonly created_at: FieldRef<"Client", 'DateTime'>
    readonly updated_at: FieldRef<"Client", 'DateTime'>
    readonly deleted_at: FieldRef<"Client", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Client findUnique
   */
  export type ClientFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client findUniqueOrThrow
   */
  export type ClientFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client findFirst
   */
  export type ClientFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Clients.
     */
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client findFirstOrThrow
   */
  export type ClientFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Clients.
     */
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client findMany
   */
  export type ClientFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Clients to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client create
   */
  export type ClientCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The data needed to create a Client.
     */
    data: XOR<ClientCreateInput, ClientUncheckedCreateInput>
  }


  /**
   * Client createMany
   */
  export type ClientCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Clients.
     */
    data: ClientCreateManyInput | ClientCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Client update
   */
  export type ClientUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The data needed to update a Client.
     */
    data: XOR<ClientUpdateInput, ClientUncheckedUpdateInput>
    /**
     * Choose, which Client to update.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client updateMany
   */
  export type ClientUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Clients.
     */
    data: XOR<ClientUpdateManyMutationInput, ClientUncheckedUpdateManyInput>
    /**
     * Filter which Clients to update
     */
    where?: ClientWhereInput
  }


  /**
   * Client upsert
   */
  export type ClientUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The filter to search for the Client to update in case it exists.
     */
    where: ClientWhereUniqueInput
    /**
     * In case the Client found by the `where` argument doesn't exist, create a new Client with this data.
     */
    create: XOR<ClientCreateInput, ClientUncheckedCreateInput>
    /**
     * In case the Client was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClientUpdateInput, ClientUncheckedUpdateInput>
  }


  /**
   * Client delete
   */
  export type ClientDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter which Client to delete.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client deleteMany
   */
  export type ClientDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Clients to delete
     */
    where?: ClientWhereInput
  }


  /**
   * Client.visits
   */
  export type Client$visitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    where?: VisitWhereInput
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    cursor?: VisitWhereUniqueInput
    take?: number
    skip?: number
    distinct?: VisitScalarFieldEnum | VisitScalarFieldEnum[]
  }


  /**
   * Client without action
   */
  export type ClientDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
  }



  /**
   * Model Visit
   */

  export type AggregateVisit = {
    _count: VisitCountAggregateOutputType | null
    _min: VisitMinAggregateOutputType | null
    _max: VisitMaxAggregateOutputType | null
  }

  export type VisitMinAggregateOutputType = {
    id: string | null
    carer_id: string | null
    client_id: string | null
    scheduled_start: Date | null
    scheduled_end: Date | null
    actual_start: Date | null
    actual_end: Date | null
    status: $Enums.VisitStatus | null
    notes: string | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type VisitMaxAggregateOutputType = {
    id: string | null
    carer_id: string | null
    client_id: string | null
    scheduled_start: Date | null
    scheduled_end: Date | null
    actual_start: Date | null
    actual_end: Date | null
    status: $Enums.VisitStatus | null
    notes: string | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type VisitCountAggregateOutputType = {
    id: number
    carer_id: number
    client_id: number
    scheduled_start: number
    scheduled_end: number
    actual_start: number
    actual_end: number
    status: number
    notes: number
    created_at: number
    updated_at: number
    deleted_at: number
    _all: number
  }


  export type VisitMinAggregateInputType = {
    id?: true
    carer_id?: true
    client_id?: true
    scheduled_start?: true
    scheduled_end?: true
    actual_start?: true
    actual_end?: true
    status?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type VisitMaxAggregateInputType = {
    id?: true
    carer_id?: true
    client_id?: true
    scheduled_start?: true
    scheduled_end?: true
    actual_start?: true
    actual_end?: true
    status?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type VisitCountAggregateInputType = {
    id?: true
    carer_id?: true
    client_id?: true
    scheduled_start?: true
    scheduled_end?: true
    actual_start?: true
    actual_end?: true
    status?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
    _all?: true
  }

  export type VisitAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Visit to aggregate.
     */
    where?: VisitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Visits to fetch.
     */
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: VisitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Visits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Visits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Visits
    **/
    _count?: true | VisitCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: VisitMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: VisitMaxAggregateInputType
  }

  export type GetVisitAggregateType<T extends VisitAggregateArgs> = {
        [P in keyof T & keyof AggregateVisit]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVisit[P]>
      : GetScalarType<T[P], AggregateVisit[P]>
  }




  export type VisitGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VisitWhereInput
    orderBy?: VisitOrderByWithAggregationInput | VisitOrderByWithAggregationInput[]
    by: VisitScalarFieldEnum[] | VisitScalarFieldEnum
    having?: VisitScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: VisitCountAggregateInputType | true
    _min?: VisitMinAggregateInputType
    _max?: VisitMaxAggregateInputType
  }

  export type VisitGroupByOutputType = {
    id: string
    carer_id: string
    client_id: string
    scheduled_start: Date
    scheduled_end: Date
    actual_start: Date | null
    actual_end: Date | null
    status: $Enums.VisitStatus
    notes: string | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    _count: VisitCountAggregateOutputType | null
    _min: VisitMinAggregateOutputType | null
    _max: VisitMaxAggregateOutputType | null
  }

  type GetVisitGroupByPayload<T extends VisitGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VisitGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof VisitGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], VisitGroupByOutputType[P]>
            : GetScalarType<T[P], VisitGroupByOutputType[P]>
        }
      >
    >


  export type VisitSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    carer_id?: boolean
    client_id?: boolean
    scheduled_start?: boolean
    scheduled_end?: boolean
    actual_start?: boolean
    actual_end?: boolean
    status?: boolean
    notes?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
    carer?: boolean | CarerDefaultArgs<ExtArgs>
    client?: boolean | ClientDefaultArgs<ExtArgs>
    tasks?: boolean | Visit$tasksArgs<ExtArgs>
    _count?: boolean | VisitCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["visit"]>

  export type VisitSelectScalar = {
    id?: boolean
    carer_id?: boolean
    client_id?: boolean
    scheduled_start?: boolean
    scheduled_end?: boolean
    actual_start?: boolean
    actual_end?: boolean
    status?: boolean
    notes?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
  }

  export type VisitInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    carer?: boolean | CarerDefaultArgs<ExtArgs>
    client?: boolean | ClientDefaultArgs<ExtArgs>
    tasks?: boolean | Visit$tasksArgs<ExtArgs>
    _count?: boolean | VisitCountOutputTypeDefaultArgs<ExtArgs>
  }


  export type $VisitPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Visit"
    objects: {
      carer: Prisma.$CarerPayload<ExtArgs>
      client: Prisma.$ClientPayload<ExtArgs>
      tasks: Prisma.$VisitTaskPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      carer_id: string
      client_id: string
      scheduled_start: Date
      scheduled_end: Date
      actual_start: Date | null
      actual_end: Date | null
      status: $Enums.VisitStatus
      notes: string | null
      created_at: Date
      updated_at: Date
      deleted_at: Date | null
    }, ExtArgs["result"]["visit"]>
    composites: {}
  }


  type VisitGetPayload<S extends boolean | null | undefined | VisitDefaultArgs> = $Result.GetResult<Prisma.$VisitPayload, S>

  type VisitCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<VisitFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: VisitCountAggregateInputType | true
    }

  export interface VisitDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Visit'], meta: { name: 'Visit' } }
    /**
     * Find zero or one Visit that matches the filter.
     * @param {VisitFindUniqueArgs} args - Arguments to find a Visit
     * @example
     * // Get one Visit
     * const visit = await prisma.visit.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends VisitFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, VisitFindUniqueArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Visit that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {VisitFindUniqueOrThrowArgs} args - Arguments to find a Visit
     * @example
     * // Get one Visit
     * const visit = await prisma.visit.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends VisitFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Visit that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitFindFirstArgs} args - Arguments to find a Visit
     * @example
     * // Get one Visit
     * const visit = await prisma.visit.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends VisitFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitFindFirstArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Visit that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitFindFirstOrThrowArgs} args - Arguments to find a Visit
     * @example
     * // Get one Visit
     * const visit = await prisma.visit.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends VisitFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Visits that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Visits
     * const visits = await prisma.visit.findMany()
     * 
     * // Get first 10 Visits
     * const visits = await prisma.visit.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const visitWithIdOnly = await prisma.visit.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends VisitFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Visit.
     * @param {VisitCreateArgs} args - Arguments to create a Visit.
     * @example
     * // Create one Visit
     * const Visit = await prisma.visit.create({
     *   data: {
     *     // ... data to create a Visit
     *   }
     * })
     * 
    **/
    create<T extends VisitCreateArgs<ExtArgs>>(
      args: SelectSubset<T, VisitCreateArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Visits.
     *     @param {VisitCreateManyArgs} args - Arguments to create many Visits.
     *     @example
     *     // Create many Visits
     *     const visit = await prisma.visit.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends VisitCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Visit.
     * @param {VisitDeleteArgs} args - Arguments to delete one Visit.
     * @example
     * // Delete one Visit
     * const Visit = await prisma.visit.delete({
     *   where: {
     *     // ... filter to delete one Visit
     *   }
     * })
     * 
    **/
    delete<T extends VisitDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, VisitDeleteArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Visit.
     * @param {VisitUpdateArgs} args - Arguments to update one Visit.
     * @example
     * // Update one Visit
     * const visit = await prisma.visit.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends VisitUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, VisitUpdateArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Visits.
     * @param {VisitDeleteManyArgs} args - Arguments to filter Visits to delete.
     * @example
     * // Delete a few Visits
     * const { count } = await prisma.visit.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends VisitDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Visits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Visits
     * const visit = await prisma.visit.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends VisitUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, VisitUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Visit.
     * @param {VisitUpsertArgs} args - Arguments to update or create a Visit.
     * @example
     * // Update or create a Visit
     * const visit = await prisma.visit.upsert({
     *   create: {
     *     // ... data to create a Visit
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Visit we want to update
     *   }
     * })
    **/
    upsert<T extends VisitUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, VisitUpsertArgs<ExtArgs>>
    ): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Visits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitCountArgs} args - Arguments to filter Visits to count.
     * @example
     * // Count the number of Visits
     * const count = await prisma.visit.count({
     *   where: {
     *     // ... the filter for the Visits we want to count
     *   }
     * })
    **/
    count<T extends VisitCountArgs>(
      args?: Subset<T, VisitCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], VisitCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Visit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VisitAggregateArgs>(args: Subset<T, VisitAggregateArgs>): Prisma.PrismaPromise<GetVisitAggregateType<T>>

    /**
     * Group by Visit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends VisitGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VisitGroupByArgs['orderBy'] }
        : { orderBy?: VisitGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, VisitGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVisitGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Visit model
   */
  readonly fields: VisitFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Visit.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VisitClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';

    carer<T extends CarerDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CarerDefaultArgs<ExtArgs>>): Prisma__CarerClient<$Result.GetResult<Prisma.$CarerPayload<ExtArgs>, T, 'findUniqueOrThrow'> | Null, Null, ExtArgs>;

    client<T extends ClientDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClientDefaultArgs<ExtArgs>>): Prisma__ClientClient<$Result.GetResult<Prisma.$ClientPayload<ExtArgs>, T, 'findUniqueOrThrow'> | Null, Null, ExtArgs>;

    tasks<T extends Visit$tasksArgs<ExtArgs> = {}>(args?: Subset<T, Visit$tasksArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findMany'> | Null>;

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }



  /**
   * Fields of the Visit model
   */ 
  interface VisitFieldRefs {
    readonly id: FieldRef<"Visit", 'String'>
    readonly carer_id: FieldRef<"Visit", 'String'>
    readonly client_id: FieldRef<"Visit", 'String'>
    readonly scheduled_start: FieldRef<"Visit", 'DateTime'>
    readonly scheduled_end: FieldRef<"Visit", 'DateTime'>
    readonly actual_start: FieldRef<"Visit", 'DateTime'>
    readonly actual_end: FieldRef<"Visit", 'DateTime'>
    readonly status: FieldRef<"Visit", 'VisitStatus'>
    readonly notes: FieldRef<"Visit", 'String'>
    readonly created_at: FieldRef<"Visit", 'DateTime'>
    readonly updated_at: FieldRef<"Visit", 'DateTime'>
    readonly deleted_at: FieldRef<"Visit", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Visit findUnique
   */
  export type VisitFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter, which Visit to fetch.
     */
    where: VisitWhereUniqueInput
  }


  /**
   * Visit findUniqueOrThrow
   */
  export type VisitFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter, which Visit to fetch.
     */
    where: VisitWhereUniqueInput
  }


  /**
   * Visit findFirst
   */
  export type VisitFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter, which Visit to fetch.
     */
    where?: VisitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Visits to fetch.
     */
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Visits.
     */
    cursor?: VisitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Visits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Visits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Visits.
     */
    distinct?: VisitScalarFieldEnum | VisitScalarFieldEnum[]
  }


  /**
   * Visit findFirstOrThrow
   */
  export type VisitFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter, which Visit to fetch.
     */
    where?: VisitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Visits to fetch.
     */
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Visits.
     */
    cursor?: VisitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Visits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Visits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Visits.
     */
    distinct?: VisitScalarFieldEnum | VisitScalarFieldEnum[]
  }


  /**
   * Visit findMany
   */
  export type VisitFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter, which Visits to fetch.
     */
    where?: VisitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Visits to fetch.
     */
    orderBy?: VisitOrderByWithRelationInput | VisitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Visits.
     */
    cursor?: VisitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Visits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Visits.
     */
    skip?: number
    distinct?: VisitScalarFieldEnum | VisitScalarFieldEnum[]
  }


  /**
   * Visit create
   */
  export type VisitCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * The data needed to create a Visit.
     */
    data: XOR<VisitCreateInput, VisitUncheckedCreateInput>
  }


  /**
   * Visit createMany
   */
  export type VisitCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Visits.
     */
    data: VisitCreateManyInput | VisitCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Visit update
   */
  export type VisitUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * The data needed to update a Visit.
     */
    data: XOR<VisitUpdateInput, VisitUncheckedUpdateInput>
    /**
     * Choose, which Visit to update.
     */
    where: VisitWhereUniqueInput
  }


  /**
   * Visit updateMany
   */
  export type VisitUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Visits.
     */
    data: XOR<VisitUpdateManyMutationInput, VisitUncheckedUpdateManyInput>
    /**
     * Filter which Visits to update
     */
    where?: VisitWhereInput
  }


  /**
   * Visit upsert
   */
  export type VisitUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * The filter to search for the Visit to update in case it exists.
     */
    where: VisitWhereUniqueInput
    /**
     * In case the Visit found by the `where` argument doesn't exist, create a new Visit with this data.
     */
    create: XOR<VisitCreateInput, VisitUncheckedCreateInput>
    /**
     * In case the Visit was found with the provided `where` argument, update it with this data.
     */
    update: XOR<VisitUpdateInput, VisitUncheckedUpdateInput>
  }


  /**
   * Visit delete
   */
  export type VisitDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
    /**
     * Filter which Visit to delete.
     */
    where: VisitWhereUniqueInput
  }


  /**
   * Visit deleteMany
   */
  export type VisitDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Visits to delete
     */
    where?: VisitWhereInput
  }


  /**
   * Visit.tasks
   */
  export type Visit$tasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    where?: VisitTaskWhereInput
    orderBy?: VisitTaskOrderByWithRelationInput | VisitTaskOrderByWithRelationInput[]
    cursor?: VisitTaskWhereUniqueInput
    take?: number
    skip?: number
    distinct?: VisitTaskScalarFieldEnum | VisitTaskScalarFieldEnum[]
  }


  /**
   * Visit without action
   */
  export type VisitDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Visit
     */
    select?: VisitSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitInclude<ExtArgs> | null
  }



  /**
   * Model VisitTask
   */

  export type AggregateVisitTask = {
    _count: VisitTaskCountAggregateOutputType | null
    _min: VisitTaskMinAggregateOutputType | null
    _max: VisitTaskMaxAggregateOutputType | null
  }

  export type VisitTaskMinAggregateOutputType = {
    id: string | null
    visit_id: string | null
    task_name: string | null
    description: string | null
    is_completed: boolean | null
    completed_at: Date | null
    notes: string | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type VisitTaskMaxAggregateOutputType = {
    id: string | null
    visit_id: string | null
    task_name: string | null
    description: string | null
    is_completed: boolean | null
    completed_at: Date | null
    notes: string | null
    created_at: Date | null
    updated_at: Date | null
    deleted_at: Date | null
  }

  export type VisitTaskCountAggregateOutputType = {
    id: number
    visit_id: number
    task_name: number
    description: number
    is_completed: number
    completed_at: number
    notes: number
    created_at: number
    updated_at: number
    deleted_at: number
    _all: number
  }


  export type VisitTaskMinAggregateInputType = {
    id?: true
    visit_id?: true
    task_name?: true
    description?: true
    is_completed?: true
    completed_at?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type VisitTaskMaxAggregateInputType = {
    id?: true
    visit_id?: true
    task_name?: true
    description?: true
    is_completed?: true
    completed_at?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
  }

  export type VisitTaskCountAggregateInputType = {
    id?: true
    visit_id?: true
    task_name?: true
    description?: true
    is_completed?: true
    completed_at?: true
    notes?: true
    created_at?: true
    updated_at?: true
    deleted_at?: true
    _all?: true
  }

  export type VisitTaskAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which VisitTask to aggregate.
     */
    where?: VisitTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VisitTasks to fetch.
     */
    orderBy?: VisitTaskOrderByWithRelationInput | VisitTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: VisitTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VisitTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VisitTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned VisitTasks
    **/
    _count?: true | VisitTaskCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: VisitTaskMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: VisitTaskMaxAggregateInputType
  }

  export type GetVisitTaskAggregateType<T extends VisitTaskAggregateArgs> = {
        [P in keyof T & keyof AggregateVisitTask]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVisitTask[P]>
      : GetScalarType<T[P], AggregateVisitTask[P]>
  }




  export type VisitTaskGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VisitTaskWhereInput
    orderBy?: VisitTaskOrderByWithAggregationInput | VisitTaskOrderByWithAggregationInput[]
    by: VisitTaskScalarFieldEnum[] | VisitTaskScalarFieldEnum
    having?: VisitTaskScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: VisitTaskCountAggregateInputType | true
    _min?: VisitTaskMinAggregateInputType
    _max?: VisitTaskMaxAggregateInputType
  }

  export type VisitTaskGroupByOutputType = {
    id: string
    visit_id: string
    task_name: string
    description: string | null
    is_completed: boolean
    completed_at: Date | null
    notes: string | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    _count: VisitTaskCountAggregateOutputType | null
    _min: VisitTaskMinAggregateOutputType | null
    _max: VisitTaskMaxAggregateOutputType | null
  }

  type GetVisitTaskGroupByPayload<T extends VisitTaskGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VisitTaskGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof VisitTaskGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], VisitTaskGroupByOutputType[P]>
            : GetScalarType<T[P], VisitTaskGroupByOutputType[P]>
        }
      >
    >


  export type VisitTaskSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    visit_id?: boolean
    task_name?: boolean
    description?: boolean
    is_completed?: boolean
    completed_at?: boolean
    notes?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
    visit?: boolean | VisitDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["visitTask"]>

  export type VisitTaskSelectScalar = {
    id?: boolean
    visit_id?: boolean
    task_name?: boolean
    description?: boolean
    is_completed?: boolean
    completed_at?: boolean
    notes?: boolean
    created_at?: boolean
    updated_at?: boolean
    deleted_at?: boolean
  }

  export type VisitTaskInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    visit?: boolean | VisitDefaultArgs<ExtArgs>
  }


  export type $VisitTaskPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "VisitTask"
    objects: {
      visit: Prisma.$VisitPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      visit_id: string
      task_name: string
      description: string | null
      is_completed: boolean
      completed_at: Date | null
      notes: string | null
      created_at: Date
      updated_at: Date
      deleted_at: Date | null
    }, ExtArgs["result"]["visitTask"]>
    composites: {}
  }


  type VisitTaskGetPayload<S extends boolean | null | undefined | VisitTaskDefaultArgs> = $Result.GetResult<Prisma.$VisitTaskPayload, S>

  type VisitTaskCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<VisitTaskFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: VisitTaskCountAggregateInputType | true
    }

  export interface VisitTaskDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['VisitTask'], meta: { name: 'VisitTask' } }
    /**
     * Find zero or one VisitTask that matches the filter.
     * @param {VisitTaskFindUniqueArgs} args - Arguments to find a VisitTask
     * @example
     * // Get one VisitTask
     * const visitTask = await prisma.visitTask.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends VisitTaskFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskFindUniqueArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one VisitTask that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {VisitTaskFindUniqueOrThrowArgs} args - Arguments to find a VisitTask
     * @example
     * // Get one VisitTask
     * const visitTask = await prisma.visitTask.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends VisitTaskFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first VisitTask that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskFindFirstArgs} args - Arguments to find a VisitTask
     * @example
     * // Get one VisitTask
     * const visitTask = await prisma.visitTask.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends VisitTaskFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskFindFirstArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first VisitTask that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskFindFirstOrThrowArgs} args - Arguments to find a VisitTask
     * @example
     * // Get one VisitTask
     * const visitTask = await prisma.visitTask.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends VisitTaskFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more VisitTasks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all VisitTasks
     * const visitTasks = await prisma.visitTask.findMany()
     * 
     * // Get first 10 VisitTasks
     * const visitTasks = await prisma.visitTask.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const visitTaskWithIdOnly = await prisma.visitTask.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends VisitTaskFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a VisitTask.
     * @param {VisitTaskCreateArgs} args - Arguments to create a VisitTask.
     * @example
     * // Create one VisitTask
     * const VisitTask = await prisma.visitTask.create({
     *   data: {
     *     // ... data to create a VisitTask
     *   }
     * })
     * 
    **/
    create<T extends VisitTaskCreateArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskCreateArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many VisitTasks.
     *     @param {VisitTaskCreateManyArgs} args - Arguments to create many VisitTasks.
     *     @example
     *     // Create many VisitTasks
     *     const visitTask = await prisma.visitTask.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends VisitTaskCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a VisitTask.
     * @param {VisitTaskDeleteArgs} args - Arguments to delete one VisitTask.
     * @example
     * // Delete one VisitTask
     * const VisitTask = await prisma.visitTask.delete({
     *   where: {
     *     // ... filter to delete one VisitTask
     *   }
     * })
     * 
    **/
    delete<T extends VisitTaskDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskDeleteArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one VisitTask.
     * @param {VisitTaskUpdateArgs} args - Arguments to update one VisitTask.
     * @example
     * // Update one VisitTask
     * const visitTask = await prisma.visitTask.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends VisitTaskUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskUpdateArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more VisitTasks.
     * @param {VisitTaskDeleteManyArgs} args - Arguments to filter VisitTasks to delete.
     * @example
     * // Delete a few VisitTasks
     * const { count } = await prisma.visitTask.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends VisitTaskDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, VisitTaskDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more VisitTasks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many VisitTasks
     * const visitTask = await prisma.visitTask.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends VisitTaskUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one VisitTask.
     * @param {VisitTaskUpsertArgs} args - Arguments to update or create a VisitTask.
     * @example
     * // Update or create a VisitTask
     * const visitTask = await prisma.visitTask.upsert({
     *   create: {
     *     // ... data to create a VisitTask
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the VisitTask we want to update
     *   }
     * })
    **/
    upsert<T extends VisitTaskUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, VisitTaskUpsertArgs<ExtArgs>>
    ): Prisma__VisitTaskClient<$Result.GetResult<Prisma.$VisitTaskPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of VisitTasks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskCountArgs} args - Arguments to filter VisitTasks to count.
     * @example
     * // Count the number of VisitTasks
     * const count = await prisma.visitTask.count({
     *   where: {
     *     // ... the filter for the VisitTasks we want to count
     *   }
     * })
    **/
    count<T extends VisitTaskCountArgs>(
      args?: Subset<T, VisitTaskCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], VisitTaskCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a VisitTask.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VisitTaskAggregateArgs>(args: Subset<T, VisitTaskAggregateArgs>): Prisma.PrismaPromise<GetVisitTaskAggregateType<T>>

    /**
     * Group by VisitTask.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VisitTaskGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends VisitTaskGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VisitTaskGroupByArgs['orderBy'] }
        : { orderBy?: VisitTaskGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, VisitTaskGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVisitTaskGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the VisitTask model
   */
  readonly fields: VisitTaskFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for VisitTask.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VisitTaskClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';

    visit<T extends VisitDefaultArgs<ExtArgs> = {}>(args?: Subset<T, VisitDefaultArgs<ExtArgs>>): Prisma__VisitClient<$Result.GetResult<Prisma.$VisitPayload<ExtArgs>, T, 'findUniqueOrThrow'> | Null, Null, ExtArgs>;

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }



  /**
   * Fields of the VisitTask model
   */ 
  interface VisitTaskFieldRefs {
    readonly id: FieldRef<"VisitTask", 'String'>
    readonly visit_id: FieldRef<"VisitTask", 'String'>
    readonly task_name: FieldRef<"VisitTask", 'String'>
    readonly description: FieldRef<"VisitTask", 'String'>
    readonly is_completed: FieldRef<"VisitTask", 'Boolean'>
    readonly completed_at: FieldRef<"VisitTask", 'DateTime'>
    readonly notes: FieldRef<"VisitTask", 'String'>
    readonly created_at: FieldRef<"VisitTask", 'DateTime'>
    readonly updated_at: FieldRef<"VisitTask", 'DateTime'>
    readonly deleted_at: FieldRef<"VisitTask", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * VisitTask findUnique
   */
  export type VisitTaskFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter, which VisitTask to fetch.
     */
    where: VisitTaskWhereUniqueInput
  }


  /**
   * VisitTask findUniqueOrThrow
   */
  export type VisitTaskFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter, which VisitTask to fetch.
     */
    where: VisitTaskWhereUniqueInput
  }


  /**
   * VisitTask findFirst
   */
  export type VisitTaskFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter, which VisitTask to fetch.
     */
    where?: VisitTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VisitTasks to fetch.
     */
    orderBy?: VisitTaskOrderByWithRelationInput | VisitTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for VisitTasks.
     */
    cursor?: VisitTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VisitTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VisitTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of VisitTasks.
     */
    distinct?: VisitTaskScalarFieldEnum | VisitTaskScalarFieldEnum[]
  }


  /**
   * VisitTask findFirstOrThrow
   */
  export type VisitTaskFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter, which VisitTask to fetch.
     */
    where?: VisitTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VisitTasks to fetch.
     */
    orderBy?: VisitTaskOrderByWithRelationInput | VisitTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for VisitTasks.
     */
    cursor?: VisitTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VisitTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VisitTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of VisitTasks.
     */
    distinct?: VisitTaskScalarFieldEnum | VisitTaskScalarFieldEnum[]
  }


  /**
   * VisitTask findMany
   */
  export type VisitTaskFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter, which VisitTasks to fetch.
     */
    where?: VisitTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VisitTasks to fetch.
     */
    orderBy?: VisitTaskOrderByWithRelationInput | VisitTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing VisitTasks.
     */
    cursor?: VisitTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VisitTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VisitTasks.
     */
    skip?: number
    distinct?: VisitTaskScalarFieldEnum | VisitTaskScalarFieldEnum[]
  }


  /**
   * VisitTask create
   */
  export type VisitTaskCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * The data needed to create a VisitTask.
     */
    data: XOR<VisitTaskCreateInput, VisitTaskUncheckedCreateInput>
  }


  /**
   * VisitTask createMany
   */
  export type VisitTaskCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many VisitTasks.
     */
    data: VisitTaskCreateManyInput | VisitTaskCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * VisitTask update
   */
  export type VisitTaskUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * The data needed to update a VisitTask.
     */
    data: XOR<VisitTaskUpdateInput, VisitTaskUncheckedUpdateInput>
    /**
     * Choose, which VisitTask to update.
     */
    where: VisitTaskWhereUniqueInput
  }


  /**
   * VisitTask updateMany
   */
  export type VisitTaskUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update VisitTasks.
     */
    data: XOR<VisitTaskUpdateManyMutationInput, VisitTaskUncheckedUpdateManyInput>
    /**
     * Filter which VisitTasks to update
     */
    where?: VisitTaskWhereInput
  }


  /**
   * VisitTask upsert
   */
  export type VisitTaskUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * The filter to search for the VisitTask to update in case it exists.
     */
    where: VisitTaskWhereUniqueInput
    /**
     * In case the VisitTask found by the `where` argument doesn't exist, create a new VisitTask with this data.
     */
    create: XOR<VisitTaskCreateInput, VisitTaskUncheckedCreateInput>
    /**
     * In case the VisitTask was found with the provided `where` argument, update it with this data.
     */
    update: XOR<VisitTaskUpdateInput, VisitTaskUncheckedUpdateInput>
  }


  /**
   * VisitTask delete
   */
  export type VisitTaskDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
    /**
     * Filter which VisitTask to delete.
     */
    where: VisitTaskWhereUniqueInput
  }


  /**
   * VisitTask deleteMany
   */
  export type VisitTaskDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which VisitTasks to delete
     */
    where?: VisitTaskWhereInput
  }


  /**
   * VisitTask without action
   */
  export type VisitTaskDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VisitTask
     */
    select?: VisitTaskSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: VisitTaskInclude<ExtArgs> | null
  }



  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const CarerScalarFieldEnum: {
    id: 'id',
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    phone: 'phone',
    hire_date: 'hire_date',
    is_active: 'is_active',
    created_at: 'created_at',
    updated_at: 'updated_at',
    deleted_at: 'deleted_at'
  };

  export type CarerScalarFieldEnum = (typeof CarerScalarFieldEnum)[keyof typeof CarerScalarFieldEnum]


  export const ClientScalarFieldEnum: {
    id: 'id',
    full_name: 'full_name',
    address_line1: 'address_line1',
    address_line2: 'address_line2',
    city: 'city',
    postcode: 'postcode',
    date_of_birth: 'date_of_birth',
    created_at: 'created_at',
    updated_at: 'updated_at',
    deleted_at: 'deleted_at'
  };

  export type ClientScalarFieldEnum = (typeof ClientScalarFieldEnum)[keyof typeof ClientScalarFieldEnum]


  export const VisitScalarFieldEnum: {
    id: 'id',
    carer_id: 'carer_id',
    client_id: 'client_id',
    scheduled_start: 'scheduled_start',
    scheduled_end: 'scheduled_end',
    actual_start: 'actual_start',
    actual_end: 'actual_end',
    status: 'status',
    notes: 'notes',
    created_at: 'created_at',
    updated_at: 'updated_at',
    deleted_at: 'deleted_at'
  };

  export type VisitScalarFieldEnum = (typeof VisitScalarFieldEnum)[keyof typeof VisitScalarFieldEnum]


  export const VisitTaskScalarFieldEnum: {
    id: 'id',
    visit_id: 'visit_id',
    task_name: 'task_name',
    description: 'description',
    is_completed: 'is_completed',
    completed_at: 'completed_at',
    notes: 'notes',
    created_at: 'created_at',
    updated_at: 'updated_at',
    deleted_at: 'deleted_at'
  };

  export type VisitTaskScalarFieldEnum = (typeof VisitTaskScalarFieldEnum)[keyof typeof VisitTaskScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'VisitStatus'
   */
  export type EnumVisitStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'VisitStatus'>
    


  /**
   * Reference to a field of type 'VisitStatus[]'
   */
  export type ListEnumVisitStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'VisitStatus[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type CarerWhereInput = {
    AND?: CarerWhereInput | CarerWhereInput[]
    OR?: CarerWhereInput[]
    NOT?: CarerWhereInput | CarerWhereInput[]
    id?: StringFilter<"Carer"> | string
    first_name?: StringFilter<"Carer"> | string
    last_name?: StringFilter<"Carer"> | string
    email?: StringFilter<"Carer"> | string
    phone?: StringNullableFilter<"Carer"> | string | null
    hire_date?: DateTimeFilter<"Carer"> | Date | string
    is_active?: BoolFilter<"Carer"> | boolean
    created_at?: DateTimeFilter<"Carer"> | Date | string
    updated_at?: DateTimeFilter<"Carer"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Carer"> | Date | string | null
    visits?: VisitListRelationFilter
  }

  export type CarerOrderByWithRelationInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    hire_date?: SortOrder
    is_active?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    visits?: VisitOrderByRelationAggregateInput
  }

  export type CarerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: CarerWhereInput | CarerWhereInput[]
    OR?: CarerWhereInput[]
    NOT?: CarerWhereInput | CarerWhereInput[]
    first_name?: StringFilter<"Carer"> | string
    last_name?: StringFilter<"Carer"> | string
    phone?: StringNullableFilter<"Carer"> | string | null
    hire_date?: DateTimeFilter<"Carer"> | Date | string
    is_active?: BoolFilter<"Carer"> | boolean
    created_at?: DateTimeFilter<"Carer"> | Date | string
    updated_at?: DateTimeFilter<"Carer"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Carer"> | Date | string | null
    visits?: VisitListRelationFilter
  }, "id" | "email">

  export type CarerOrderByWithAggregationInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    hire_date?: SortOrder
    is_active?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    _count?: CarerCountOrderByAggregateInput
    _max?: CarerMaxOrderByAggregateInput
    _min?: CarerMinOrderByAggregateInput
  }

  export type CarerScalarWhereWithAggregatesInput = {
    AND?: CarerScalarWhereWithAggregatesInput | CarerScalarWhereWithAggregatesInput[]
    OR?: CarerScalarWhereWithAggregatesInput[]
    NOT?: CarerScalarWhereWithAggregatesInput | CarerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Carer"> | string
    first_name?: StringWithAggregatesFilter<"Carer"> | string
    last_name?: StringWithAggregatesFilter<"Carer"> | string
    email?: StringWithAggregatesFilter<"Carer"> | string
    phone?: StringNullableWithAggregatesFilter<"Carer"> | string | null
    hire_date?: DateTimeWithAggregatesFilter<"Carer"> | Date | string
    is_active?: BoolWithAggregatesFilter<"Carer"> | boolean
    created_at?: DateTimeWithAggregatesFilter<"Carer"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"Carer"> | Date | string
    deleted_at?: DateTimeNullableWithAggregatesFilter<"Carer"> | Date | string | null
  }

  export type ClientWhereInput = {
    AND?: ClientWhereInput | ClientWhereInput[]
    OR?: ClientWhereInput[]
    NOT?: ClientWhereInput | ClientWhereInput[]
    id?: StringFilter<"Client"> | string
    full_name?: StringFilter<"Client"> | string
    address_line1?: StringFilter<"Client"> | string
    address_line2?: StringNullableFilter<"Client"> | string | null
    city?: StringFilter<"Client"> | string
    postcode?: StringFilter<"Client"> | string
    date_of_birth?: DateTimeNullableFilter<"Client"> | Date | string | null
    created_at?: DateTimeFilter<"Client"> | Date | string
    updated_at?: DateTimeFilter<"Client"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Client"> | Date | string | null
    visits?: VisitListRelationFilter
  }

  export type ClientOrderByWithRelationInput = {
    id?: SortOrder
    full_name?: SortOrder
    address_line1?: SortOrder
    address_line2?: SortOrderInput | SortOrder
    city?: SortOrder
    postcode?: SortOrder
    date_of_birth?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    visits?: VisitOrderByRelationAggregateInput
  }

  export type ClientWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ClientWhereInput | ClientWhereInput[]
    OR?: ClientWhereInput[]
    NOT?: ClientWhereInput | ClientWhereInput[]
    full_name?: StringFilter<"Client"> | string
    address_line1?: StringFilter<"Client"> | string
    address_line2?: StringNullableFilter<"Client"> | string | null
    city?: StringFilter<"Client"> | string
    postcode?: StringFilter<"Client"> | string
    date_of_birth?: DateTimeNullableFilter<"Client"> | Date | string | null
    created_at?: DateTimeFilter<"Client"> | Date | string
    updated_at?: DateTimeFilter<"Client"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Client"> | Date | string | null
    visits?: VisitListRelationFilter
  }, "id">

  export type ClientOrderByWithAggregationInput = {
    id?: SortOrder
    full_name?: SortOrder
    address_line1?: SortOrder
    address_line2?: SortOrderInput | SortOrder
    city?: SortOrder
    postcode?: SortOrder
    date_of_birth?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    _count?: ClientCountOrderByAggregateInput
    _max?: ClientMaxOrderByAggregateInput
    _min?: ClientMinOrderByAggregateInput
  }

  export type ClientScalarWhereWithAggregatesInput = {
    AND?: ClientScalarWhereWithAggregatesInput | ClientScalarWhereWithAggregatesInput[]
    OR?: ClientScalarWhereWithAggregatesInput[]
    NOT?: ClientScalarWhereWithAggregatesInput | ClientScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Client"> | string
    full_name?: StringWithAggregatesFilter<"Client"> | string
    address_line1?: StringWithAggregatesFilter<"Client"> | string
    address_line2?: StringNullableWithAggregatesFilter<"Client"> | string | null
    city?: StringWithAggregatesFilter<"Client"> | string
    postcode?: StringWithAggregatesFilter<"Client"> | string
    date_of_birth?: DateTimeNullableWithAggregatesFilter<"Client"> | Date | string | null
    created_at?: DateTimeWithAggregatesFilter<"Client"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"Client"> | Date | string
    deleted_at?: DateTimeNullableWithAggregatesFilter<"Client"> | Date | string | null
  }

  export type VisitWhereInput = {
    AND?: VisitWhereInput | VisitWhereInput[]
    OR?: VisitWhereInput[]
    NOT?: VisitWhereInput | VisitWhereInput[]
    id?: StringFilter<"Visit"> | string
    carer_id?: StringFilter<"Visit"> | string
    client_id?: StringFilter<"Visit"> | string
    scheduled_start?: DateTimeFilter<"Visit"> | Date | string
    scheduled_end?: DateTimeFilter<"Visit"> | Date | string
    actual_start?: DateTimeNullableFilter<"Visit"> | Date | string | null
    actual_end?: DateTimeNullableFilter<"Visit"> | Date | string | null
    status?: EnumVisitStatusFilter<"Visit"> | $Enums.VisitStatus
    notes?: StringNullableFilter<"Visit"> | string | null
    created_at?: DateTimeFilter<"Visit"> | Date | string
    updated_at?: DateTimeFilter<"Visit"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Visit"> | Date | string | null
    carer?: XOR<CarerRelationFilter, CarerWhereInput>
    client?: XOR<ClientRelationFilter, ClientWhereInput>
    tasks?: VisitTaskListRelationFilter
  }

  export type VisitOrderByWithRelationInput = {
    id?: SortOrder
    carer_id?: SortOrder
    client_id?: SortOrder
    scheduled_start?: SortOrder
    scheduled_end?: SortOrder
    actual_start?: SortOrderInput | SortOrder
    actual_end?: SortOrderInput | SortOrder
    status?: SortOrder
    notes?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    carer?: CarerOrderByWithRelationInput
    client?: ClientOrderByWithRelationInput
    tasks?: VisitTaskOrderByRelationAggregateInput
  }

  export type VisitWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: VisitWhereInput | VisitWhereInput[]
    OR?: VisitWhereInput[]
    NOT?: VisitWhereInput | VisitWhereInput[]
    carer_id?: StringFilter<"Visit"> | string
    client_id?: StringFilter<"Visit"> | string
    scheduled_start?: DateTimeFilter<"Visit"> | Date | string
    scheduled_end?: DateTimeFilter<"Visit"> | Date | string
    actual_start?: DateTimeNullableFilter<"Visit"> | Date | string | null
    actual_end?: DateTimeNullableFilter<"Visit"> | Date | string | null
    status?: EnumVisitStatusFilter<"Visit"> | $Enums.VisitStatus
    notes?: StringNullableFilter<"Visit"> | string | null
    created_at?: DateTimeFilter<"Visit"> | Date | string
    updated_at?: DateTimeFilter<"Visit"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Visit"> | Date | string | null
    carer?: XOR<CarerRelationFilter, CarerWhereInput>
    client?: XOR<ClientRelationFilter, ClientWhereInput>
    tasks?: VisitTaskListRelationFilter
  }, "id">

  export type VisitOrderByWithAggregationInput = {
    id?: SortOrder
    carer_id?: SortOrder
    client_id?: SortOrder
    scheduled_start?: SortOrder
    scheduled_end?: SortOrder
    actual_start?: SortOrderInput | SortOrder
    actual_end?: SortOrderInput | SortOrder
    status?: SortOrder
    notes?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    _count?: VisitCountOrderByAggregateInput
    _max?: VisitMaxOrderByAggregateInput
    _min?: VisitMinOrderByAggregateInput
  }

  export type VisitScalarWhereWithAggregatesInput = {
    AND?: VisitScalarWhereWithAggregatesInput | VisitScalarWhereWithAggregatesInput[]
    OR?: VisitScalarWhereWithAggregatesInput[]
    NOT?: VisitScalarWhereWithAggregatesInput | VisitScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Visit"> | string
    carer_id?: StringWithAggregatesFilter<"Visit"> | string
    client_id?: StringWithAggregatesFilter<"Visit"> | string
    scheduled_start?: DateTimeWithAggregatesFilter<"Visit"> | Date | string
    scheduled_end?: DateTimeWithAggregatesFilter<"Visit"> | Date | string
    actual_start?: DateTimeNullableWithAggregatesFilter<"Visit"> | Date | string | null
    actual_end?: DateTimeNullableWithAggregatesFilter<"Visit"> | Date | string | null
    status?: EnumVisitStatusWithAggregatesFilter<"Visit"> | $Enums.VisitStatus
    notes?: StringNullableWithAggregatesFilter<"Visit"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"Visit"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"Visit"> | Date | string
    deleted_at?: DateTimeNullableWithAggregatesFilter<"Visit"> | Date | string | null
  }

  export type VisitTaskWhereInput = {
    AND?: VisitTaskWhereInput | VisitTaskWhereInput[]
    OR?: VisitTaskWhereInput[]
    NOT?: VisitTaskWhereInput | VisitTaskWhereInput[]
    id?: StringFilter<"VisitTask"> | string
    visit_id?: StringFilter<"VisitTask"> | string
    task_name?: StringFilter<"VisitTask"> | string
    description?: StringNullableFilter<"VisitTask"> | string | null
    is_completed?: BoolFilter<"VisitTask"> | boolean
    completed_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
    notes?: StringNullableFilter<"VisitTask"> | string | null
    created_at?: DateTimeFilter<"VisitTask"> | Date | string
    updated_at?: DateTimeFilter<"VisitTask"> | Date | string
    deleted_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
    visit?: XOR<VisitRelationFilter, VisitWhereInput>
  }

  export type VisitTaskOrderByWithRelationInput = {
    id?: SortOrder
    visit_id?: SortOrder
    task_name?: SortOrder
    description?: SortOrderInput | SortOrder
    is_completed?: SortOrder
    completed_at?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    visit?: VisitOrderByWithRelationInput
  }

  export type VisitTaskWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: VisitTaskWhereInput | VisitTaskWhereInput[]
    OR?: VisitTaskWhereInput[]
    NOT?: VisitTaskWhereInput | VisitTaskWhereInput[]
    visit_id?: StringFilter<"VisitTask"> | string
    task_name?: StringFilter<"VisitTask"> | string
    description?: StringNullableFilter<"VisitTask"> | string | null
    is_completed?: BoolFilter<"VisitTask"> | boolean
    completed_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
    notes?: StringNullableFilter<"VisitTask"> | string | null
    created_at?: DateTimeFilter<"VisitTask"> | Date | string
    updated_at?: DateTimeFilter<"VisitTask"> | Date | string
    deleted_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
    visit?: XOR<VisitRelationFilter, VisitWhereInput>
  }, "id">

  export type VisitTaskOrderByWithAggregationInput = {
    id?: SortOrder
    visit_id?: SortOrder
    task_name?: SortOrder
    description?: SortOrderInput | SortOrder
    is_completed?: SortOrder
    completed_at?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrderInput | SortOrder
    _count?: VisitTaskCountOrderByAggregateInput
    _max?: VisitTaskMaxOrderByAggregateInput
    _min?: VisitTaskMinOrderByAggregateInput
  }

  export type VisitTaskScalarWhereWithAggregatesInput = {
    AND?: VisitTaskScalarWhereWithAggregatesInput | VisitTaskScalarWhereWithAggregatesInput[]
    OR?: VisitTaskScalarWhereWithAggregatesInput[]
    NOT?: VisitTaskScalarWhereWithAggregatesInput | VisitTaskScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"VisitTask"> | string
    visit_id?: StringWithAggregatesFilter<"VisitTask"> | string
    task_name?: StringWithAggregatesFilter<"VisitTask"> | string
    description?: StringNullableWithAggregatesFilter<"VisitTask"> | string | null
    is_completed?: BoolWithAggregatesFilter<"VisitTask"> | boolean
    completed_at?: DateTimeNullableWithAggregatesFilter<"VisitTask"> | Date | string | null
    notes?: StringNullableWithAggregatesFilter<"VisitTask"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"VisitTask"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"VisitTask"> | Date | string
    deleted_at?: DateTimeNullableWithAggregatesFilter<"VisitTask"> | Date | string | null
  }

  export type CarerCreateInput = {
    id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string | null
    hire_date?: Date | string
    is_active?: boolean
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    visits?: VisitCreateNestedManyWithoutCarerInput
  }

  export type CarerUncheckedCreateInput = {
    id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string | null
    hire_date?: Date | string
    is_active?: boolean
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    visits?: VisitUncheckedCreateNestedManyWithoutCarerInput
  }

  export type CarerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    visits?: VisitUpdateManyWithoutCarerNestedInput
  }

  export type CarerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    visits?: VisitUncheckedUpdateManyWithoutCarerNestedInput
  }

  export type CarerCreateManyInput = {
    id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string | null
    hire_date?: Date | string
    is_active?: boolean
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type CarerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CarerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClientCreateInput = {
    id?: string
    full_name: string
    address_line1: string
    address_line2?: string | null
    city: string
    postcode: string
    date_of_birth?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    visits?: VisitCreateNestedManyWithoutClientInput
  }

  export type ClientUncheckedCreateInput = {
    id?: string
    full_name: string
    address_line1: string
    address_line2?: string | null
    city: string
    postcode: string
    date_of_birth?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    visits?: VisitUncheckedCreateNestedManyWithoutClientInput
  }

  export type ClientUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    visits?: VisitUpdateManyWithoutClientNestedInput
  }

  export type ClientUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    visits?: VisitUncheckedUpdateManyWithoutClientNestedInput
  }

  export type ClientCreateManyInput = {
    id?: string
    full_name: string
    address_line1: string
    address_line2?: string | null
    city: string
    postcode: string
    date_of_birth?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type ClientUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClientUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitCreateInput = {
    id?: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    carer: CarerCreateNestedOneWithoutVisitsInput
    client: ClientCreateNestedOneWithoutVisitsInput
    tasks?: VisitTaskCreateNestedManyWithoutVisitInput
  }

  export type VisitUncheckedCreateInput = {
    id?: string
    carer_id: string
    client_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    tasks?: VisitTaskUncheckedCreateNestedManyWithoutVisitInput
  }

  export type VisitUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    carer?: CarerUpdateOneRequiredWithoutVisitsNestedInput
    client?: ClientUpdateOneRequiredWithoutVisitsNestedInput
    tasks?: VisitTaskUpdateManyWithoutVisitNestedInput
  }

  export type VisitUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    carer_id?: StringFieldUpdateOperationsInput | string
    client_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    tasks?: VisitTaskUncheckedUpdateManyWithoutVisitNestedInput
  }

  export type VisitCreateManyInput = {
    id?: string
    carer_id: string
    client_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    carer_id?: StringFieldUpdateOperationsInput | string
    client_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskCreateInput = {
    id?: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    visit: VisitCreateNestedOneWithoutTasksInput
  }

  export type VisitTaskUncheckedCreateInput = {
    id?: string
    visit_id: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitTaskUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    visit?: VisitUpdateOneRequiredWithoutTasksNestedInput
  }

  export type VisitTaskUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    visit_id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskCreateManyInput = {
    id?: string
    visit_id: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitTaskUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    visit_id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type VisitListRelationFilter = {
    every?: VisitWhereInput
    some?: VisitWhereInput
    none?: VisitWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type VisitOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CarerCountOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    hire_date?: SortOrder
    is_active?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type CarerMaxOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    hire_date?: SortOrder
    is_active?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type CarerMinOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    hire_date?: SortOrder
    is_active?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type ClientCountOrderByAggregateInput = {
    id?: SortOrder
    full_name?: SortOrder
    address_line1?: SortOrder
    address_line2?: SortOrder
    city?: SortOrder
    postcode?: SortOrder
    date_of_birth?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type ClientMaxOrderByAggregateInput = {
    id?: SortOrder
    full_name?: SortOrder
    address_line1?: SortOrder
    address_line2?: SortOrder
    city?: SortOrder
    postcode?: SortOrder
    date_of_birth?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type ClientMinOrderByAggregateInput = {
    id?: SortOrder
    full_name?: SortOrder
    address_line1?: SortOrder
    address_line2?: SortOrder
    city?: SortOrder
    postcode?: SortOrder
    date_of_birth?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type EnumVisitStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.VisitStatus | EnumVisitStatusFieldRefInput<$PrismaModel>
    in?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumVisitStatusFilter<$PrismaModel> | $Enums.VisitStatus
  }

  export type CarerRelationFilter = {
    is?: CarerWhereInput
    isNot?: CarerWhereInput
  }

  export type ClientRelationFilter = {
    is?: ClientWhereInput
    isNot?: ClientWhereInput
  }

  export type VisitTaskListRelationFilter = {
    every?: VisitTaskWhereInput
    some?: VisitTaskWhereInput
    none?: VisitTaskWhereInput
  }

  export type VisitTaskOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type VisitCountOrderByAggregateInput = {
    id?: SortOrder
    carer_id?: SortOrder
    client_id?: SortOrder
    scheduled_start?: SortOrder
    scheduled_end?: SortOrder
    actual_start?: SortOrder
    actual_end?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type VisitMaxOrderByAggregateInput = {
    id?: SortOrder
    carer_id?: SortOrder
    client_id?: SortOrder
    scheduled_start?: SortOrder
    scheduled_end?: SortOrder
    actual_start?: SortOrder
    actual_end?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type VisitMinOrderByAggregateInput = {
    id?: SortOrder
    carer_id?: SortOrder
    client_id?: SortOrder
    scheduled_start?: SortOrder
    scheduled_end?: SortOrder
    actual_start?: SortOrder
    actual_end?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type EnumVisitStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.VisitStatus | EnumVisitStatusFieldRefInput<$PrismaModel>
    in?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumVisitStatusWithAggregatesFilter<$PrismaModel> | $Enums.VisitStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumVisitStatusFilter<$PrismaModel>
    _max?: NestedEnumVisitStatusFilter<$PrismaModel>
  }

  export type VisitRelationFilter = {
    is?: VisitWhereInput
    isNot?: VisitWhereInput
  }

  export type VisitTaskCountOrderByAggregateInput = {
    id?: SortOrder
    visit_id?: SortOrder
    task_name?: SortOrder
    description?: SortOrder
    is_completed?: SortOrder
    completed_at?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type VisitTaskMaxOrderByAggregateInput = {
    id?: SortOrder
    visit_id?: SortOrder
    task_name?: SortOrder
    description?: SortOrder
    is_completed?: SortOrder
    completed_at?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type VisitTaskMinOrderByAggregateInput = {
    id?: SortOrder
    visit_id?: SortOrder
    task_name?: SortOrder
    description?: SortOrder
    is_completed?: SortOrder
    completed_at?: SortOrder
    notes?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    deleted_at?: SortOrder
  }

  export type VisitCreateNestedManyWithoutCarerInput = {
    create?: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput> | VisitCreateWithoutCarerInput[] | VisitUncheckedCreateWithoutCarerInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutCarerInput | VisitCreateOrConnectWithoutCarerInput[]
    createMany?: VisitCreateManyCarerInputEnvelope
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
  }

  export type VisitUncheckedCreateNestedManyWithoutCarerInput = {
    create?: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput> | VisitCreateWithoutCarerInput[] | VisitUncheckedCreateWithoutCarerInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutCarerInput | VisitCreateOrConnectWithoutCarerInput[]
    createMany?: VisitCreateManyCarerInputEnvelope
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type VisitUpdateManyWithoutCarerNestedInput = {
    create?: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput> | VisitCreateWithoutCarerInput[] | VisitUncheckedCreateWithoutCarerInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutCarerInput | VisitCreateOrConnectWithoutCarerInput[]
    upsert?: VisitUpsertWithWhereUniqueWithoutCarerInput | VisitUpsertWithWhereUniqueWithoutCarerInput[]
    createMany?: VisitCreateManyCarerInputEnvelope
    set?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    disconnect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    delete?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    update?: VisitUpdateWithWhereUniqueWithoutCarerInput | VisitUpdateWithWhereUniqueWithoutCarerInput[]
    updateMany?: VisitUpdateManyWithWhereWithoutCarerInput | VisitUpdateManyWithWhereWithoutCarerInput[]
    deleteMany?: VisitScalarWhereInput | VisitScalarWhereInput[]
  }

  export type VisitUncheckedUpdateManyWithoutCarerNestedInput = {
    create?: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput> | VisitCreateWithoutCarerInput[] | VisitUncheckedCreateWithoutCarerInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutCarerInput | VisitCreateOrConnectWithoutCarerInput[]
    upsert?: VisitUpsertWithWhereUniqueWithoutCarerInput | VisitUpsertWithWhereUniqueWithoutCarerInput[]
    createMany?: VisitCreateManyCarerInputEnvelope
    set?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    disconnect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    delete?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    update?: VisitUpdateWithWhereUniqueWithoutCarerInput | VisitUpdateWithWhereUniqueWithoutCarerInput[]
    updateMany?: VisitUpdateManyWithWhereWithoutCarerInput | VisitUpdateManyWithWhereWithoutCarerInput[]
    deleteMany?: VisitScalarWhereInput | VisitScalarWhereInput[]
  }

  export type VisitCreateNestedManyWithoutClientInput = {
    create?: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput> | VisitCreateWithoutClientInput[] | VisitUncheckedCreateWithoutClientInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutClientInput | VisitCreateOrConnectWithoutClientInput[]
    createMany?: VisitCreateManyClientInputEnvelope
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
  }

  export type VisitUncheckedCreateNestedManyWithoutClientInput = {
    create?: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput> | VisitCreateWithoutClientInput[] | VisitUncheckedCreateWithoutClientInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutClientInput | VisitCreateOrConnectWithoutClientInput[]
    createMany?: VisitCreateManyClientInputEnvelope
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
  }

  export type VisitUpdateManyWithoutClientNestedInput = {
    create?: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput> | VisitCreateWithoutClientInput[] | VisitUncheckedCreateWithoutClientInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutClientInput | VisitCreateOrConnectWithoutClientInput[]
    upsert?: VisitUpsertWithWhereUniqueWithoutClientInput | VisitUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: VisitCreateManyClientInputEnvelope
    set?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    disconnect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    delete?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    update?: VisitUpdateWithWhereUniqueWithoutClientInput | VisitUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: VisitUpdateManyWithWhereWithoutClientInput | VisitUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: VisitScalarWhereInput | VisitScalarWhereInput[]
  }

  export type VisitUncheckedUpdateManyWithoutClientNestedInput = {
    create?: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput> | VisitCreateWithoutClientInput[] | VisitUncheckedCreateWithoutClientInput[]
    connectOrCreate?: VisitCreateOrConnectWithoutClientInput | VisitCreateOrConnectWithoutClientInput[]
    upsert?: VisitUpsertWithWhereUniqueWithoutClientInput | VisitUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: VisitCreateManyClientInputEnvelope
    set?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    disconnect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    delete?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    connect?: VisitWhereUniqueInput | VisitWhereUniqueInput[]
    update?: VisitUpdateWithWhereUniqueWithoutClientInput | VisitUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: VisitUpdateManyWithWhereWithoutClientInput | VisitUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: VisitScalarWhereInput | VisitScalarWhereInput[]
  }

  export type CarerCreateNestedOneWithoutVisitsInput = {
    create?: XOR<CarerCreateWithoutVisitsInput, CarerUncheckedCreateWithoutVisitsInput>
    connectOrCreate?: CarerCreateOrConnectWithoutVisitsInput
    connect?: CarerWhereUniqueInput
  }

  export type ClientCreateNestedOneWithoutVisitsInput = {
    create?: XOR<ClientCreateWithoutVisitsInput, ClientUncheckedCreateWithoutVisitsInput>
    connectOrCreate?: ClientCreateOrConnectWithoutVisitsInput
    connect?: ClientWhereUniqueInput
  }

  export type VisitTaskCreateNestedManyWithoutVisitInput = {
    create?: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput> | VisitTaskCreateWithoutVisitInput[] | VisitTaskUncheckedCreateWithoutVisitInput[]
    connectOrCreate?: VisitTaskCreateOrConnectWithoutVisitInput | VisitTaskCreateOrConnectWithoutVisitInput[]
    createMany?: VisitTaskCreateManyVisitInputEnvelope
    connect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
  }

  export type VisitTaskUncheckedCreateNestedManyWithoutVisitInput = {
    create?: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput> | VisitTaskCreateWithoutVisitInput[] | VisitTaskUncheckedCreateWithoutVisitInput[]
    connectOrCreate?: VisitTaskCreateOrConnectWithoutVisitInput | VisitTaskCreateOrConnectWithoutVisitInput[]
    createMany?: VisitTaskCreateManyVisitInputEnvelope
    connect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
  }

  export type EnumVisitStatusFieldUpdateOperationsInput = {
    set?: $Enums.VisitStatus
  }

  export type CarerUpdateOneRequiredWithoutVisitsNestedInput = {
    create?: XOR<CarerCreateWithoutVisitsInput, CarerUncheckedCreateWithoutVisitsInput>
    connectOrCreate?: CarerCreateOrConnectWithoutVisitsInput
    upsert?: CarerUpsertWithoutVisitsInput
    connect?: CarerWhereUniqueInput
    update?: XOR<XOR<CarerUpdateToOneWithWhereWithoutVisitsInput, CarerUpdateWithoutVisitsInput>, CarerUncheckedUpdateWithoutVisitsInput>
  }

  export type ClientUpdateOneRequiredWithoutVisitsNestedInput = {
    create?: XOR<ClientCreateWithoutVisitsInput, ClientUncheckedCreateWithoutVisitsInput>
    connectOrCreate?: ClientCreateOrConnectWithoutVisitsInput
    upsert?: ClientUpsertWithoutVisitsInput
    connect?: ClientWhereUniqueInput
    update?: XOR<XOR<ClientUpdateToOneWithWhereWithoutVisitsInput, ClientUpdateWithoutVisitsInput>, ClientUncheckedUpdateWithoutVisitsInput>
  }

  export type VisitTaskUpdateManyWithoutVisitNestedInput = {
    create?: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput> | VisitTaskCreateWithoutVisitInput[] | VisitTaskUncheckedCreateWithoutVisitInput[]
    connectOrCreate?: VisitTaskCreateOrConnectWithoutVisitInput | VisitTaskCreateOrConnectWithoutVisitInput[]
    upsert?: VisitTaskUpsertWithWhereUniqueWithoutVisitInput | VisitTaskUpsertWithWhereUniqueWithoutVisitInput[]
    createMany?: VisitTaskCreateManyVisitInputEnvelope
    set?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    disconnect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    delete?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    connect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    update?: VisitTaskUpdateWithWhereUniqueWithoutVisitInput | VisitTaskUpdateWithWhereUniqueWithoutVisitInput[]
    updateMany?: VisitTaskUpdateManyWithWhereWithoutVisitInput | VisitTaskUpdateManyWithWhereWithoutVisitInput[]
    deleteMany?: VisitTaskScalarWhereInput | VisitTaskScalarWhereInput[]
  }

  export type VisitTaskUncheckedUpdateManyWithoutVisitNestedInput = {
    create?: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput> | VisitTaskCreateWithoutVisitInput[] | VisitTaskUncheckedCreateWithoutVisitInput[]
    connectOrCreate?: VisitTaskCreateOrConnectWithoutVisitInput | VisitTaskCreateOrConnectWithoutVisitInput[]
    upsert?: VisitTaskUpsertWithWhereUniqueWithoutVisitInput | VisitTaskUpsertWithWhereUniqueWithoutVisitInput[]
    createMany?: VisitTaskCreateManyVisitInputEnvelope
    set?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    disconnect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    delete?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    connect?: VisitTaskWhereUniqueInput | VisitTaskWhereUniqueInput[]
    update?: VisitTaskUpdateWithWhereUniqueWithoutVisitInput | VisitTaskUpdateWithWhereUniqueWithoutVisitInput[]
    updateMany?: VisitTaskUpdateManyWithWhereWithoutVisitInput | VisitTaskUpdateManyWithWhereWithoutVisitInput[]
    deleteMany?: VisitTaskScalarWhereInput | VisitTaskScalarWhereInput[]
  }

  export type VisitCreateNestedOneWithoutTasksInput = {
    create?: XOR<VisitCreateWithoutTasksInput, VisitUncheckedCreateWithoutTasksInput>
    connectOrCreate?: VisitCreateOrConnectWithoutTasksInput
    connect?: VisitWhereUniqueInput
  }

  export type VisitUpdateOneRequiredWithoutTasksNestedInput = {
    create?: XOR<VisitCreateWithoutTasksInput, VisitUncheckedCreateWithoutTasksInput>
    connectOrCreate?: VisitCreateOrConnectWithoutTasksInput
    upsert?: VisitUpsertWithoutTasksInput
    connect?: VisitWhereUniqueInput
    update?: XOR<XOR<VisitUpdateToOneWithWhereWithoutTasksInput, VisitUpdateWithoutTasksInput>, VisitUncheckedUpdateWithoutTasksInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumVisitStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.VisitStatus | EnumVisitStatusFieldRefInput<$PrismaModel>
    in?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumVisitStatusFilter<$PrismaModel> | $Enums.VisitStatus
  }

  export type NestedEnumVisitStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.VisitStatus | EnumVisitStatusFieldRefInput<$PrismaModel>
    in?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.VisitStatus[] | ListEnumVisitStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumVisitStatusWithAggregatesFilter<$PrismaModel> | $Enums.VisitStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumVisitStatusFilter<$PrismaModel>
    _max?: NestedEnumVisitStatusFilter<$PrismaModel>
  }

  export type VisitCreateWithoutCarerInput = {
    id?: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    client: ClientCreateNestedOneWithoutVisitsInput
    tasks?: VisitTaskCreateNestedManyWithoutVisitInput
  }

  export type VisitUncheckedCreateWithoutCarerInput = {
    id?: string
    client_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    tasks?: VisitTaskUncheckedCreateNestedManyWithoutVisitInput
  }

  export type VisitCreateOrConnectWithoutCarerInput = {
    where: VisitWhereUniqueInput
    create: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput>
  }

  export type VisitCreateManyCarerInputEnvelope = {
    data: VisitCreateManyCarerInput | VisitCreateManyCarerInput[]
    skipDuplicates?: boolean
  }

  export type VisitUpsertWithWhereUniqueWithoutCarerInput = {
    where: VisitWhereUniqueInput
    update: XOR<VisitUpdateWithoutCarerInput, VisitUncheckedUpdateWithoutCarerInput>
    create: XOR<VisitCreateWithoutCarerInput, VisitUncheckedCreateWithoutCarerInput>
  }

  export type VisitUpdateWithWhereUniqueWithoutCarerInput = {
    where: VisitWhereUniqueInput
    data: XOR<VisitUpdateWithoutCarerInput, VisitUncheckedUpdateWithoutCarerInput>
  }

  export type VisitUpdateManyWithWhereWithoutCarerInput = {
    where: VisitScalarWhereInput
    data: XOR<VisitUpdateManyMutationInput, VisitUncheckedUpdateManyWithoutCarerInput>
  }

  export type VisitScalarWhereInput = {
    AND?: VisitScalarWhereInput | VisitScalarWhereInput[]
    OR?: VisitScalarWhereInput[]
    NOT?: VisitScalarWhereInput | VisitScalarWhereInput[]
    id?: StringFilter<"Visit"> | string
    carer_id?: StringFilter<"Visit"> | string
    client_id?: StringFilter<"Visit"> | string
    scheduled_start?: DateTimeFilter<"Visit"> | Date | string
    scheduled_end?: DateTimeFilter<"Visit"> | Date | string
    actual_start?: DateTimeNullableFilter<"Visit"> | Date | string | null
    actual_end?: DateTimeNullableFilter<"Visit"> | Date | string | null
    status?: EnumVisitStatusFilter<"Visit"> | $Enums.VisitStatus
    notes?: StringNullableFilter<"Visit"> | string | null
    created_at?: DateTimeFilter<"Visit"> | Date | string
    updated_at?: DateTimeFilter<"Visit"> | Date | string
    deleted_at?: DateTimeNullableFilter<"Visit"> | Date | string | null
  }

  export type VisitCreateWithoutClientInput = {
    id?: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    carer: CarerCreateNestedOneWithoutVisitsInput
    tasks?: VisitTaskCreateNestedManyWithoutVisitInput
  }

  export type VisitUncheckedCreateWithoutClientInput = {
    id?: string
    carer_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    tasks?: VisitTaskUncheckedCreateNestedManyWithoutVisitInput
  }

  export type VisitCreateOrConnectWithoutClientInput = {
    where: VisitWhereUniqueInput
    create: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput>
  }

  export type VisitCreateManyClientInputEnvelope = {
    data: VisitCreateManyClientInput | VisitCreateManyClientInput[]
    skipDuplicates?: boolean
  }

  export type VisitUpsertWithWhereUniqueWithoutClientInput = {
    where: VisitWhereUniqueInput
    update: XOR<VisitUpdateWithoutClientInput, VisitUncheckedUpdateWithoutClientInput>
    create: XOR<VisitCreateWithoutClientInput, VisitUncheckedCreateWithoutClientInput>
  }

  export type VisitUpdateWithWhereUniqueWithoutClientInput = {
    where: VisitWhereUniqueInput
    data: XOR<VisitUpdateWithoutClientInput, VisitUncheckedUpdateWithoutClientInput>
  }

  export type VisitUpdateManyWithWhereWithoutClientInput = {
    where: VisitScalarWhereInput
    data: XOR<VisitUpdateManyMutationInput, VisitUncheckedUpdateManyWithoutClientInput>
  }

  export type CarerCreateWithoutVisitsInput = {
    id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string | null
    hire_date?: Date | string
    is_active?: boolean
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type CarerUncheckedCreateWithoutVisitsInput = {
    id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string | null
    hire_date?: Date | string
    is_active?: boolean
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type CarerCreateOrConnectWithoutVisitsInput = {
    where: CarerWhereUniqueInput
    create: XOR<CarerCreateWithoutVisitsInput, CarerUncheckedCreateWithoutVisitsInput>
  }

  export type ClientCreateWithoutVisitsInput = {
    id?: string
    full_name: string
    address_line1: string
    address_line2?: string | null
    city: string
    postcode: string
    date_of_birth?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type ClientUncheckedCreateWithoutVisitsInput = {
    id?: string
    full_name: string
    address_line1: string
    address_line2?: string | null
    city: string
    postcode: string
    date_of_birth?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type ClientCreateOrConnectWithoutVisitsInput = {
    where: ClientWhereUniqueInput
    create: XOR<ClientCreateWithoutVisitsInput, ClientUncheckedCreateWithoutVisitsInput>
  }

  export type VisitTaskCreateWithoutVisitInput = {
    id?: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitTaskUncheckedCreateWithoutVisitInput = {
    id?: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitTaskCreateOrConnectWithoutVisitInput = {
    where: VisitTaskWhereUniqueInput
    create: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput>
  }

  export type VisitTaskCreateManyVisitInputEnvelope = {
    data: VisitTaskCreateManyVisitInput | VisitTaskCreateManyVisitInput[]
    skipDuplicates?: boolean
  }

  export type CarerUpsertWithoutVisitsInput = {
    update: XOR<CarerUpdateWithoutVisitsInput, CarerUncheckedUpdateWithoutVisitsInput>
    create: XOR<CarerCreateWithoutVisitsInput, CarerUncheckedCreateWithoutVisitsInput>
    where?: CarerWhereInput
  }

  export type CarerUpdateToOneWithWhereWithoutVisitsInput = {
    where?: CarerWhereInput
    data: XOR<CarerUpdateWithoutVisitsInput, CarerUncheckedUpdateWithoutVisitsInput>
  }

  export type CarerUpdateWithoutVisitsInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CarerUncheckedUpdateWithoutVisitsInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClientUpsertWithoutVisitsInput = {
    update: XOR<ClientUpdateWithoutVisitsInput, ClientUncheckedUpdateWithoutVisitsInput>
    create: XOR<ClientCreateWithoutVisitsInput, ClientUncheckedCreateWithoutVisitsInput>
    where?: ClientWhereInput
  }

  export type ClientUpdateToOneWithWhereWithoutVisitsInput = {
    where?: ClientWhereInput
    data: XOR<ClientUpdateWithoutVisitsInput, ClientUncheckedUpdateWithoutVisitsInput>
  }

  export type ClientUpdateWithoutVisitsInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClientUncheckedUpdateWithoutVisitsInput = {
    id?: StringFieldUpdateOperationsInput | string
    full_name?: StringFieldUpdateOperationsInput | string
    address_line1?: StringFieldUpdateOperationsInput | string
    address_line2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: StringFieldUpdateOperationsInput | string
    postcode?: StringFieldUpdateOperationsInput | string
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskUpsertWithWhereUniqueWithoutVisitInput = {
    where: VisitTaskWhereUniqueInput
    update: XOR<VisitTaskUpdateWithoutVisitInput, VisitTaskUncheckedUpdateWithoutVisitInput>
    create: XOR<VisitTaskCreateWithoutVisitInput, VisitTaskUncheckedCreateWithoutVisitInput>
  }

  export type VisitTaskUpdateWithWhereUniqueWithoutVisitInput = {
    where: VisitTaskWhereUniqueInput
    data: XOR<VisitTaskUpdateWithoutVisitInput, VisitTaskUncheckedUpdateWithoutVisitInput>
  }

  export type VisitTaskUpdateManyWithWhereWithoutVisitInput = {
    where: VisitTaskScalarWhereInput
    data: XOR<VisitTaskUpdateManyMutationInput, VisitTaskUncheckedUpdateManyWithoutVisitInput>
  }

  export type VisitTaskScalarWhereInput = {
    AND?: VisitTaskScalarWhereInput | VisitTaskScalarWhereInput[]
    OR?: VisitTaskScalarWhereInput[]
    NOT?: VisitTaskScalarWhereInput | VisitTaskScalarWhereInput[]
    id?: StringFilter<"VisitTask"> | string
    visit_id?: StringFilter<"VisitTask"> | string
    task_name?: StringFilter<"VisitTask"> | string
    description?: StringNullableFilter<"VisitTask"> | string | null
    is_completed?: BoolFilter<"VisitTask"> | boolean
    completed_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
    notes?: StringNullableFilter<"VisitTask"> | string | null
    created_at?: DateTimeFilter<"VisitTask"> | Date | string
    updated_at?: DateTimeFilter<"VisitTask"> | Date | string
    deleted_at?: DateTimeNullableFilter<"VisitTask"> | Date | string | null
  }

  export type VisitCreateWithoutTasksInput = {
    id?: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
    carer: CarerCreateNestedOneWithoutVisitsInput
    client: ClientCreateNestedOneWithoutVisitsInput
  }

  export type VisitUncheckedCreateWithoutTasksInput = {
    id?: string
    carer_id: string
    client_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitCreateOrConnectWithoutTasksInput = {
    where: VisitWhereUniqueInput
    create: XOR<VisitCreateWithoutTasksInput, VisitUncheckedCreateWithoutTasksInput>
  }

  export type VisitUpsertWithoutTasksInput = {
    update: XOR<VisitUpdateWithoutTasksInput, VisitUncheckedUpdateWithoutTasksInput>
    create: XOR<VisitCreateWithoutTasksInput, VisitUncheckedCreateWithoutTasksInput>
    where?: VisitWhereInput
  }

  export type VisitUpdateToOneWithWhereWithoutTasksInput = {
    where?: VisitWhereInput
    data: XOR<VisitUpdateWithoutTasksInput, VisitUncheckedUpdateWithoutTasksInput>
  }

  export type VisitUpdateWithoutTasksInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    carer?: CarerUpdateOneRequiredWithoutVisitsNestedInput
    client?: ClientUpdateOneRequiredWithoutVisitsNestedInput
  }

  export type VisitUncheckedUpdateWithoutTasksInput = {
    id?: StringFieldUpdateOperationsInput | string
    carer_id?: StringFieldUpdateOperationsInput | string
    client_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitCreateManyCarerInput = {
    id?: string
    client_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitUpdateWithoutCarerInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    client?: ClientUpdateOneRequiredWithoutVisitsNestedInput
    tasks?: VisitTaskUpdateManyWithoutVisitNestedInput
  }

  export type VisitUncheckedUpdateWithoutCarerInput = {
    id?: StringFieldUpdateOperationsInput | string
    client_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    tasks?: VisitTaskUncheckedUpdateManyWithoutVisitNestedInput
  }

  export type VisitUncheckedUpdateManyWithoutCarerInput = {
    id?: StringFieldUpdateOperationsInput | string
    client_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitCreateManyClientInput = {
    id?: string
    carer_id: string
    scheduled_start: Date | string
    scheduled_end: Date | string
    actual_start?: Date | string | null
    actual_end?: Date | string | null
    status?: $Enums.VisitStatus
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    carer?: CarerUpdateOneRequiredWithoutVisitsNestedInput
    tasks?: VisitTaskUpdateManyWithoutVisitNestedInput
  }

  export type VisitUncheckedUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    carer_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    tasks?: VisitTaskUncheckedUpdateManyWithoutVisitNestedInput
  }

  export type VisitUncheckedUpdateManyWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    carer_id?: StringFieldUpdateOperationsInput | string
    scheduled_start?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduled_end?: DateTimeFieldUpdateOperationsInput | Date | string
    actual_start?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    actual_end?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: EnumVisitStatusFieldUpdateOperationsInput | $Enums.VisitStatus
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskCreateManyVisitInput = {
    id?: string
    task_name: string
    description?: string | null
    is_completed?: boolean
    completed_at?: Date | string | null
    notes?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    deleted_at?: Date | string | null
  }

  export type VisitTaskUpdateWithoutVisitInput = {
    id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskUncheckedUpdateWithoutVisitInput = {
    id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type VisitTaskUncheckedUpdateManyWithoutVisitInput = {
    id?: StringFieldUpdateOperationsInput | string
    task_name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    is_completed?: BoolFieldUpdateOperationsInput | boolean
    completed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use CarerCountOutputTypeDefaultArgs instead
     */
    export type CarerCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CarerCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClientCountOutputTypeDefaultArgs instead
     */
    export type ClientCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClientCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use VisitCountOutputTypeDefaultArgs instead
     */
    export type VisitCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = VisitCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use CarerDefaultArgs instead
     */
    export type CarerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CarerDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClientDefaultArgs instead
     */
    export type ClientArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClientDefaultArgs<ExtArgs>
    /**
     * @deprecated Use VisitDefaultArgs instead
     */
    export type VisitArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = VisitDefaultArgs<ExtArgs>
    /**
     * @deprecated Use VisitTaskDefaultArgs instead
     */
    export type VisitTaskArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = VisitTaskDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}