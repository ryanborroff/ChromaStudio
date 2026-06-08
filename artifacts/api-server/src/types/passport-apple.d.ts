declare module "passport-apple" {
  import type { Request } from "express";

  export interface AppleStrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    privateKeyString?: string;
    privateKeyLocation?: string;
    callbackURL: string;
    scope?: string[] | string;
    passReqToCallback?: boolean;
    state?: boolean;
  }

  export type AppleVerifyCallback = (
    error: Error | null,
    user?: Express.User | false,
    info?: unknown,
  ) => void;

  export type AppleVerifyFunction = (
    req: Request,
    accessToken: string,
    refreshToken: string,
    idToken: { sub: string; email?: string; [key: string]: unknown },
    profile: unknown,
    done: AppleVerifyCallback,
  ) => void;

  export class Strategy {
    constructor(options: AppleStrategyOptions, verify: AppleVerifyFunction);
    name: string;
    authenticate(req: Request, options?: unknown): void;
  }

  export default Strategy;
}
