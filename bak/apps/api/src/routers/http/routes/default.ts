import { DefaultService } from '../../../services/default';
import { publicHttp } from '../../../utils/http';
import { createRouteHandler } from '../../../utils/route-handler';

export default {
  '': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
  '/': publicHttp.get(() => createRouteHandler(DefaultService, 'root')),
};
