import { TestService } from '../../services/test';
import { createHttpRouter, defineHttpRoute } from '../utils';

const testRouter = createHttpRouter([
  defineHttpRoute({
    handlerFn: TestService.hello,
    method: 'get',
    path: '/test/hello',
  }),
  defineHttpRoute({
    handlerFn: TestService.profile,
    method: 'post',
    path: '/test/profile',
  }),
]);

export { testRouter };
