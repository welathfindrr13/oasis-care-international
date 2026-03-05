import { ObjectType, Field, Int } from '@nestjs/graphql';
// Re-use the existing ClientDTO from visit module to avoid GraphQL schema conflicts
export { ClientDTO } from '../../visit/dto/visit.dto';
import { ClientDTO } from '../../visit/dto/visit.dto';

@ObjectType()
export class ClientPaginatedResponse {
  @Field(() => [ClientDTO])
  items!: ClientDTO[];

  @Field(() => Int)
  total!: number;
}
