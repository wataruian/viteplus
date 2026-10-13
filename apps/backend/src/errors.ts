import { HTTPException } from 'hono/http-exception';

import { config } from './config';

const genericServerErrorMessage = 'Internal Server Error';

const toClientErrorMessage = (status: number, message: string): string =>
  status < 500 || (config.enableErrorStack && message !== '') ? message : genericServerErrorMessage;

const toClientErrorStack = (stack: string | undefined): string | undefined =>
  config.enableErrorStack ? stack : undefined;

class ReportedHttpException extends HTTPException {
  public override readonly name = 'ReportedHttpException';
}

export {
  genericServerErrorMessage,
  ReportedHttpException,
  toClientErrorMessage,
  toClientErrorStack,
};
