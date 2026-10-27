import { backendBaseUrl } from '@lightproject/common/configs';
import { commonEnv } from '@lightproject/common/environment';

import { env } from './env';

const config = {
  get backendUrl() {
    return commonEnv.BACKEND_URL ?? backendBaseUrl;
  },
  get frontendPort() {
    return env.FRONTEND_PORT ?? 2001;
  },
};

export { config };
