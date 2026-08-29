import { DefaultService } from '../../services/default';
import { createHttpRouter, defineHttpRoute } from '../utils';

const defaultRouter = createHttpRouter([
  defineHttpRoute({
    handlerFn: DefaultService.root,
    method: 'get',
    path: '/',
  }),
]);

export { defaultRouter };
