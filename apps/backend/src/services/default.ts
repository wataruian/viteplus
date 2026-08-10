import type { InputArgs, ServiceContext } from '../middlewares/initialize-request';
import { BaseService } from './base';
import type { InferSchemaMap } from '../utils/autogen/utils/zod';
import z from 'zod';

const DefaultServiceInputSchemas = {
  root: z.void(),
};

const DefaultServiceOutputSchemas = {
  root: z.object({ customMessage: z.string() }),
};

class DefaultService extends BaseService {
  public constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  public static root(
    _input: z.infer<typeof DefaultServiceInputSchemas.root>,
  ): z.infer<typeof DefaultServiceOutputSchemas.root> {
    return { customMessage: 'OK' };
  }
}

type DefaultServiceInputs = InferSchemaMap<typeof DefaultServiceInputSchemas>;
type DefaultServiceOutputs = InferSchemaMap<typeof DefaultServiceOutputSchemas>;

export type { DefaultServiceInputs, DefaultServiceOutputs };
export { DefaultServiceInputSchemas, DefaultServiceOutputSchemas, DefaultService };
