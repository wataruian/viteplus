import { TestService } from '../../services/test';
import { createHttpRouter, defineHttpRoute } from '../utils';

const testRouter = createHttpRouter([
  defineHttpRoute({
    handlerFn: TestService.createUser,
    method: 'post',
    path: '/test/users',
  }),
  defineHttpRoute({
    handlerFn: TestService.enqueuePing,
    method: 'post',
    path: '/test/ping',
  }),
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
