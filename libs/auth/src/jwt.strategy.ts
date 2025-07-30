import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  preferred_username: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
  exp: number;
  iat: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
      // For Keycloak, you might want to use RS256 with public key
      // secretOrKeyProvider: (request, rawJwtToken, done) => {
      //   // Fetch public key from Keycloak
      //   done(null, publicKey);
      // }
    };
    super(options);
  }

  async validate(payload: JwtPayload): Promise<any> {
    return {
      sub: payload.sub,
      username: payload.preferred_username,
      realm_access: payload.realm_access,
      resource_access: payload.resource_access,
    };
  }
}
