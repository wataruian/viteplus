import type { Locals } from './middlware';

declare global {
  namespace Express {
    interface Request {
      locals: Locals;
    }
    interface Response {
      locals: Locals;
    }
  }
}
