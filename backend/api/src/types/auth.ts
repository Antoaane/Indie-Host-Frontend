import type { JWTPayload } from 'jose';

export type RequestAuth = {
  userId: string;
  payload: JWTPayload;
};
