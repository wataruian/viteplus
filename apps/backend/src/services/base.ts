import {
  type InputArgs,
  type ServiceContext,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from '../types/middlware';

const assertIsGetInstanceFn: (fn: unknown) => asserts fn is () => BaseServiceInterface = (
  _fn: unknown,
) => {};

interface BaseServiceInterface {
  /**
   * Method to clean up resources used by the service.
   * This method is intended to be overridden by derived classes to perform cleanup operations.
   */
  cleanup?(): Promise<void>;

  /**
   * The context of the service, which contains the request and response objects.
   * This property is used to access the request and response objects in the service methods.
   */
  context: ServiceContext;

  /**
   * Getter for the context of the service.
   * This method is used to get the context of the service.
   * It is intended to be used by derived classes to access the context of the service.
   */
  get ctx(): ServiceContext;

  /**
   * Setter for the context of the service.
   * This method is used to set the context of the service.
   * It is intended to be used by derived classes to set the context of the service.
   */
  set ctx(ctx: ServiceContext);

  /**
   * Static method to get the singleton instance of the service.
   * This method is used to get the singleton instance of the service.
   * It is intended to be used by derived classes to get the singleton instance of the service.
   */
  getInstance(): BaseServiceInterface;

  /**
   * Getter for the input arguments of the service.
   * This method is used to get the input arguments for the service methods.
   * It is intended to be used by derived classes to access the input arguments for the service methods.
   */
  get input(): InputArgs;

  /**
   * Setter for the input arguments of the service.
   * This method is used to set the input arguments for the service methods.
   * It is intended to be used by derived classes to set the input arguments for the service methods.
   */
  set input(inputArgs: InputArgs);

  /**
   * Input arguments for the service.
   * This property is used to store the input arguments passed to the service methods.
   */
  inputArgs: InputArgs;

  /**
   * Instance of the service.
   * This is a static property that holds the singleton instance of the service.
   * It is used to ensure that only one instance of the service is created.
   */
  instance: BaseServiceInterface | null;
}

abstract class BaseService implements BaseServiceInterface {
  public static instance: BaseService | null = null;

  public context: ServiceContext;
  public inputArgs: InputArgs = {};

  public get ctx(): ServiceContext {
    return this.context;
  }

  public set ctx(ctx: ServiceContext) {
    this.context = ctx;
  }

  public get input(): InputArgs {
    return this.inputArgs;
  }

  public set input(inputArgs: InputArgs) {
    this.inputArgs = inputArgs;
  }

  private _instance: BaseServiceInterface | null = null;

  public get instance(): BaseServiceInterface | null {
    return this._instance ?? BaseService.instance;
  }

  public set instance(value: BaseServiceInterface | null) {
    this._instance = value;
    BaseService.instance = value instanceof BaseService ? value : null;
  }

  public constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    this.context = ctx;
    this.inputArgs = inputArgs;
  }

  public static getInstance<T extends BaseService>(
    this: new (ctx: ServiceContext, inputArgs?: InputArgs) => T,
  ): T {
    if (BaseService.instance === null) {
      const req: unknown = { locals: {} };
      assertIsCustomRequest(req);
      const res: unknown = { locals: {} };
      assertIsCustomResponse(res);
      const dummyContext: ServiceContext = {
        req,
        res,
      };
      BaseService.instance = new this(dummyContext);
    }
    if (BaseService.instance instanceof this) {
      return BaseService.instance;
    }
    throw new Error('Failed to get service instance');
  }

  public getInstance(): BaseServiceInterface {
    const ctor = this.constructor;
    const getInstance: unknown = Reflect.get(ctor, 'getInstance');

    if (typeof getInstance === 'function') {
      assertIsGetInstanceFn(getInstance);
      return getInstance();
    }
    throw new Error('getInstance not found on service constructor');
  }

  public static cleanup?(): Promise<void> {
    return Promise.resolve();
  }
}

export { BaseService };
export type { BaseServiceInterface };
