import { Request } from 'express';

export interface RequestUser {
  designationCode?: string;
}

export type RequestWithUser = Request & {
  user?: RequestUser;
};
