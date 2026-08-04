import {
  TestService,
  TestServiceInputSchemas,
  TestServiceOutputSchemas,
} from '../../../services/test';
import { createRouteHandler } from '../../../utils/route-handler';
import { publicHttp } from '../../../utils/http';

const routes = {
  '/test/async-fail-reject': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncFailReject', {
      input: TestServiceInputSchemas.asyncFailReject,
      output: TestServiceOutputSchemas.asyncFailReject,
    }),
  ),
  '/test/async-fail-throw': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncFailThrow', {
      input: TestServiceInputSchemas.asyncFailThrow,
      output: TestServiceOutputSchemas.asyncFailThrow,
    }),
  ),
  '/test/async-success': publicHttp.get(() =>
    createRouteHandler(TestService, 'asyncSuccess', {
      input: TestServiceInputSchemas.asyncSuccess,
      output: TestServiceOutputSchemas.asyncSuccess,
    }),
  ),
  '/test/check-params': publicHttp.post(() =>
    createRouteHandler(TestService, 'checkParams', {
      input: TestServiceInputSchemas.checkParams,
      output: TestServiceOutputSchemas.checkParams,
    }),
  ),
  '/test/custom-type-array': publicHttp.post(() =>
    createRouteHandler(TestService, 'customTypeArray', {
      input: TestServiceInputSchemas.customTypeArray,
      output: TestServiceOutputSchemas.customTypeArray,
    }),
  ),
  '/test/custom-type-single': publicHttp.post(() =>
    createRouteHandler(TestService, 'customTypeSingle', {
      input: TestServiceInputSchemas.customTypeSingle,
      output: TestServiceOutputSchemas.customTypeSingle,
    }),
  ),
  '/test/get-with-param': publicHttp.get(() =>
    createRouteHandler(TestService, 'getWithParam', {
      input: TestServiceInputSchemas.getWithParam,
      output: TestServiceOutputSchemas.getWithParam,
    }),
  ),
  '/test/hello': publicHttp.post(() =>
    createRouteHandler(TestService, 'hello', {
      input: TestServiceInputSchemas.hello,
      output: TestServiceOutputSchemas.hello,
    }),
  ),
  '/test/mixed-params': publicHttp.post(() =>
    createRouteHandler(TestService, 'mixedParams', {
      input: TestServiceInputSchemas.mixedParams,
      output: TestServiceOutputSchemas.mixedParams,
    }),
  ),
  '/test/object-destructured': publicHttp.post(() =>
    createRouteHandler(TestService, 'objectDestructured', {
      input: TestServiceInputSchemas.objectDestructured,
      output: TestServiceOutputSchemas.objectDestructured,
    }),
  ),
  '/test/object-only': publicHttp.post(() =>
    createRouteHandler(TestService, 'objectOnly', {
      input: TestServiceInputSchemas.objectOnly,
      output: TestServiceOutputSchemas.objectOnly,
    }),
  ),
  '/test/primitives-and-array': publicHttp.post(() =>
    createRouteHandler(TestService, 'primitivesAndArray', {
      input: TestServiceInputSchemas.primitivesAndArray,
      output: TestServiceOutputSchemas.primitivesAndArray,
    }),
  ),
  '/test/sync-fail-reject': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncFailReject', {
      input: TestServiceInputSchemas.syncFailReject,
      output: TestServiceOutputSchemas.syncFailReject,
    }),
  ),
  '/test/sync-fail-throw': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncFailThrow', {
      input: TestServiceInputSchemas.syncFailThrow,
      output: TestServiceOutputSchemas.syncFailThrow,
    }),
  ),
  '/test/sync-success': publicHttp.get(() =>
    createRouteHandler(TestService, 'syncSuccess', {
      input: TestServiceInputSchemas.syncSuccess,
      output: TestServiceOutputSchemas.syncSuccess,
    }),
  ),
};

export default routes;
