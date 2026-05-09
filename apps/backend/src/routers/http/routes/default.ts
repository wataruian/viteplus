import { DefaultService } from '../../../services/default';
import { createRouteHandler } from '../../../utils/route-handler';
import { publicHttp } from '../../../utils/http';

export default {
  '': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
  '/': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
};
