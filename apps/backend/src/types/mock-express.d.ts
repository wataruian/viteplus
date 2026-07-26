declare module 'mock-express' {
  interface MockExpressRequest {
    host?: string;
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    [key: string]: unknown;
  }

  type MockExpressResponse = Record<string, unknown>;

  interface MockExpressApp {
    makeRequest: (options?: MockExpressRequest) => MockExpressRequest;
    makeResponse: (callback?: (err: Error | null) => void) => MockExpressResponse;
  }

  function MockExpress(): MockExpressApp;

  export default MockExpress;
}
