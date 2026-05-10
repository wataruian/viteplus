import { DefaultService } from '../../../services/default';
import { createRouteHandler } from '../../../utils/route-handler';
import { publicHttp } from '../../../utils/http';

const routes = {
  '': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
  '/': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
};

export default routes;
