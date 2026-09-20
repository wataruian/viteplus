import * as https from 'node:https';

const insecureTlsRequest = (): void => {
  https.request({ hostname: 'example.com', rejectUnauthorized: false }, () => {});
};

export { insecureTlsRequest };
