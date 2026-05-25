import { SetMetadata } from '@nestjs/common';

export const CarebridgeRoles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);
