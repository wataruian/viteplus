import type { InputArgs, ServiceContext } from '../types/middlware';
import { BaseService } from './base';

class DefaultService extends BaseService {
  public constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  public static root() {
    return { message: 'OK' };
  }
}

export { DefaultService };
