import type { InputArgs, ServiceContext } from '../types/middlware';

import { BaseService } from './base';

class DefaultService extends BaseService {
  constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  root() {
    return { message: 'OK' };
  }
}

export { DefaultService };
