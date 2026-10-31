import { backendBaseUrl } from '@lightproject/common/configs';
import { commonEnv } from '@lightproject/common/environment';

const config = {
  get backendUrl() {
    return commonEnv.BACKEND_URL ?? backendBaseUrl;
  },
};

export { config };
