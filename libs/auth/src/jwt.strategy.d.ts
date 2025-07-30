import { Strategy } from 'passport-jwt';
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
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor();
    validate(payload: JwtPayload): Promise<any>;
}
export {};
