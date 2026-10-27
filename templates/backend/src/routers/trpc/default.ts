import { DefaultService } from '../../services/default';
import { createQuery, defineTrpcRoute, t } from '../utils';

const defaultRouter = t.router({
  root: createQuery(
    defineTrpcRoute({
      handlerFn: DefaultService.root,
      inputOptional: true,
      method: 'get',
      path: '/default.root',
    }),
  ),
});

export { defaultRouter };
