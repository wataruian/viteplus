import { getEnv, isTrue } from '@lightproject/common/environment';

const config = {
  get viteApiUrl() {
    return getEnv('VITE_API_URL');
  },
  get viteEnableTestRoutes() {
    return isTrue(getEnv('VITE_ENABLE_TEST_ROUTES'));
  },
};

export { config };
