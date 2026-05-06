import { TestService } from '../../../services/test';
import { publicHttp } from '../../../utils/http';
import { createRouteHandler } from '../../../utils/route-handler';

export default {
  '/test/_check-params': publicHttp.post(() =>
    createRouteHandler(TestService, '_checkParams')
  ),
  '/test/async-fail-reject': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncFailReject')
  ),
  '/test/async-fail-throw': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncFailThrow')
  ),
  '/test/async-success': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncSuccess')
  ),
  '/test/hello': publicHttp.post(() =>
    createRouteHandler(TestService, 'hello')
  ),
  '/test/mixed-params': publicHttp.post(() =>
    createRouteHandler(TestService, 'mixedParams')
  ),
  '/test/object-destructured': publicHttp.post(() =>
    createRouteHandler(TestService, 'objectDestructured')
  ),
  '/test/object-only': publicHttp.post(() =>
    createRouteHandler(TestService, 'objectOnly')
  ),
  '/test/primitives-and-array': publicHttp.post(() =>
    createRouteHandler(TestService, 'primitivesAndArray')
  ),
  '/test/sync-fail-reject': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncFailReject')
  ),
  '/test/sync-fail-throw': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncFailThrow')
  ),
  '/test/sync-success': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncSuccess')
  ),
};
