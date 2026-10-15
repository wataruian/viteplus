import type { Context } from '@opentelemetry/api';
import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-web';

import { getRequestIdsFor } from '../logger/context';

const requestContextSpanProcessor: SpanProcessor = {
  forceFlush: async () => {
    await Promise.resolve();
  },
  onEnd: () => {
    // Attributes are only added on start.
  },
  onStart: (span: Span, parentContext: Context) => {
    const { clientId, requestId } = getRequestIdsFor(parentContext);
    if (requestId !== undefined && span.attributes['request.id'] === undefined) {
      span.setAttribute('request.id', requestId);
    }
    if (clientId !== undefined && span.attributes['client.id'] === undefined) {
      span.setAttribute('client.id', clientId);
    }
  },
  shutdown: async () => {
    await Promise.resolve();
  },
};

export { requestContextSpanProcessor };
