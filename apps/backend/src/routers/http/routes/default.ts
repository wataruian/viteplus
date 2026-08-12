import {
  DefaultService,
  DefaultServiceInputSchemas,
  DefaultServiceOutputSchemas,
} from '../../../services/default';
import { publicHttp } from '../../../utils/http';
import { createRouteHandler } from '../../../utils/route-handler';

const routes = {
  '': publicHttp.get(() =>
    createRouteHandler(DefaultService, 'root', {
      input: DefaultServiceInputSchemas.root,
      output: DefaultServiceOutputSchemas.root,
    }),
  ),
  '/': publicHttp.get(() =>
    createRouteHandler(DefaultService, 'root', {
      input: DefaultServiceInputSchemas.root,
      output: DefaultServiceOutputSchemas.root,
    }),
  ),
};

export default routes;
