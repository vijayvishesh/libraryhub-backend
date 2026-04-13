import { HttpError } from 'routing-controllers';

export class ConflictError extends HttpError {
  constructor(message = 'CONFLICT') {
    super(409, message);
  }
}
