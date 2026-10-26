import { TestService } from '../../services/test';
import { createMutation, createQuery, defineTrpcRoute, t } from '../utils';

const testRouter = t.router({
  hello: createQuery(
    defineTrpcRoute({
      handlerFn: TestService.hello,
      inputOptional: true,
      method: 'get',
      path: '/test.hello',
    }),
  ),
  profile: createMutation(
    defineTrpcRoute({
      handlerFn: TestService.profile,
      method: 'post',
      path: '/test.profile',
    }),
  ),
});

export { testRouter };
