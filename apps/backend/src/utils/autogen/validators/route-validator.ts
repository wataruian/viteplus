import type { RouteInfo } from '../types';
import { logger } from '@lightproject/common/logger';

interface ValidationConfig {
  enforceServiceNaming: boolean;
  requiredServiceDirectory: string;
  strictConventions: boolean;
  validateParameters: boolean;
}

interface ValidationError {
  code: string;
  filePath?: string | undefined;
  message: string;
  path?: string | undefined;
  severity: 'error' | 'warning';
  suggestion?: string | undefined;
  type: 'consistency' | 'convention' | 'naming' | 'structure';
}

interface ValidationResult {
  errors: ValidationError[];
  isValid: boolean;
  warnings: ValidationError[];
}

class RouteValidator {
  private readonly config: ValidationConfig;

  private errors: ValidationError[] = [];

  private warnings: ValidationError[] = [];

  public constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      enforceServiceNaming: true,
      requiredServiceDirectory: '/src/services/',
      strictConventions: true,
      validateParameters: true,
      ...config,
    };
  }

  private static formatValidationIssue(issue: ValidationError): string {
    let output = `  - ${issue.code}: ${issue.message}\n`;

    if (issue.filePath !== undefined && issue.filePath !== '') {
      output += `    File: ${issue.filePath}\n`;
    }

    if (issue.path !== undefined && issue.path !== '') {
      output += `    Path: ${issue.path}\n`;
    }

    if (issue.suggestion !== undefined && issue.suggestion !== '') {
      output += `    💡 ${issue.suggestion}\n`;
    }

    return output;
  }

  private static formatErrorsSection(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    let section = `❌ Errors: ${errors.length}\n`;

    for (const error of errors) {
      section += RouteValidator.formatValidationIssue(error);
    }

    return section;
  }

  private static formatWarningsSection(warnings: ValidationError[]): string {
    if (warnings.length === 0) {
      return '';
    }

    let section = `⚠️  Warnings: ${warnings.length}\n`;

    for (const warning of warnings) {
      section += RouteValidator.formatValidationIssue(warning);
    }

    return section;
  }

  public static getSummary(result: ValidationResult): string {
    const { errors, warnings } = result;
    const total = errors.length + warnings.length;

    if (total === 0) {
      return '✅ All routes passed validation';
    }

    let summary = `📋 Validation Summary: ${total} issues found\n`;

    summary += RouteValidator.formatErrorsSection(errors);
    summary += RouteValidator.formatWarningsSection(warnings);

    return summary;
  }

  public validate(routes: RouteInfo[]): ValidationResult {
    this.errors = [];
    this.warnings = [];

    logger.info(`Validating ${routes.length} routes...`);

    for (const route of routes) {
      this.validateRoute(route);
    }

    const isValid = this.errors.length === 0;

    if (isValid) {
      logger.info(`✅ All routes passed validation (${this.warnings.length} warnings)`);
    } else {
      logger.warn(
        `Validation found ${this.errors.length} errors and ${this.warnings.length} warnings`,
      );
    }

    return {
      errors: this.errors,
      isValid,
      warnings: this.warnings,
    };
  }

  private addError(error: Omit<ValidationError, 'severity'>): void {
    this.errors.push({
      ...error,
      severity: 'error',
    });
  }

  private addWarning(warning: Omit<ValidationError, 'severity'>): void {
    this.warnings.push({
      ...warning,
      severity: 'warning',
    });
  }

  private static getExpectedServiceFileName(serviceClass: string): string {
    const baseName = serviceClass.replace(/Service$/, '');

    const kebabCase = baseName
      .replaceAll(
        /([A-Z])/g,
        (_match: string, letter: string): string => `-${letter.toLowerCase()}`,
      )
      .replace(/^-/, '');

    return `${kebabCase}.ts`;
  }

  private validateConventions(route: RouteInfo): void {
    if (!this.config.strictConventions) {
      return;
    }

    const hasServiceClass = route.serviceClass !== undefined && route.serviceClass !== '';

    const hasServiceMethod = route.serviceMethod !== undefined && route.serviceMethod !== '';

    if (!(hasServiceClass && hasServiceMethod)) {
      this.addError({
        code: 'MISSING_ROUTE_HANDLER_PATTERN',
        filePath: route.handlerFilePath,
        message: 'Route must use createRouteHandler(ServiceClass, "methodName") pattern',
        path: route.path,
        suggestion: 'Use: createRouteHandler(MyService, "methodName")',
        type: 'convention',
      });
    }

    if (route.requestType === 'HTTP' && route.method !== undefined && route.method !== '') {
      this.validateHttpMethodConsistency(route);
    }

    if (route.requestType === 'tRPC' && route.type !== undefined && route.type !== '') {
      this.validateTrpcProcedureType(route);
    }
  }

  private validateFileStructure(route: RouteInfo): void {
    if (route.serviceFilePath === undefined || route.serviceFilePath === '') {
      return;
    }

    if (!route.serviceFilePath.includes(this.config.requiredServiceDirectory)) {
      this.addError({
        code: 'INVALID_SERVICE_LOCATION',
        filePath: route.handlerFilePath,
        message: `Service file must be in ${this.config.requiredServiceDirectory} directory`,
        path: route.path,
        suggestion: `Move service to: ${this.config.requiredServiceDirectory}`,
        type: 'structure',
      });
    }

    if (route.serviceClass !== undefined && route.serviceClass !== '') {
      const expectedFileName = RouteValidator.getExpectedServiceFileName(route.serviceClass);

      if (!route.serviceFilePath.includes(expectedFileName)) {
        this.addWarning({
          code: 'MISMATCHED_SERVICE_FILENAME',
          filePath: route.handlerFilePath,
          message: 'Service filename should match class name convention',
          path: route.path,
          suggestion: `Expected filename: ${expectedFileName}`,
          type: 'naming',
        });
      }
    }
  }

  private validateHttpMethodConsistency(route: RouteInfo): void {
    const { method, serviceMethod } = route;

    if (
      method === undefined ||
      method === '' ||
      serviceMethod === undefined ||
      serviceMethod === ''
    ) {
      return;
    }

    const normalizedMethod = method.toLowerCase();

    const normalizedServiceMethod = serviceMethod.toLowerCase();

    if (
      normalizedMethod === 'get' &&
      (normalizedServiceMethod.includes('create') ||
        normalizedServiceMethod.includes('update') ||
        normalizedServiceMethod.includes('delete'))
    ) {
      this.addWarning({
        code: 'HTTP_METHOD_MISMATCH',
        filePath: route.handlerFilePath,
        message: `GET method with ${serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using POST/PUT/DELETE for mutations',
        type: 'consistency',
      });
    }

    if (
      (normalizedMethod === 'post' || normalizedMethod === 'put') &&
      normalizedServiceMethod.startsWith('get')
    ) {
      this.addWarning({
        code: 'HTTP_METHOD_MISMATCH',
        filePath: route.handlerFilePath,
        message: `${normalizedMethod.toUpperCase()} method with ${serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using GET for queries',
        type: 'consistency',
      });
    }
  }

  private validatePathFormats(route: RouteInfo): void {
    const hasPath = route.path !== '';

    const hasRequestType = route.requestType !== '';

    if (!(hasPath && hasRequestType)) {
      return;
    }

    if (route.requestType === 'HTTP') {
      if (route.path.startsWith('/trpc')) {
        this.addError({
          code: 'INVALID_HTTP_PATH',
          filePath: route.handlerFilePath,
          message: 'HTTP route path should not start with /trpc',
          path: route.path,
          type: 'convention',
        });
      }
    } else if (route.requestType === 'tRPC') {
      if (!route.path.startsWith('/trpc/')) {
        this.addError({
          code: 'INVALID_TRPC_PATH',
          filePath: route.handlerFilePath,
          message: 'tRPC route path must start with /trpc/',
          path: route.path,
          type: 'convention',
        });
      }

      if (route.path.includes('/trpc/') && !route.path.includes('.')) {
        this.addWarning({
          code: 'MISSING_TRPC_DOT_NOTATION',
          filePath: route.handlerFilePath,
          message: 'tRPC route should use dot notation for method names',
          path: route.path,
          suggestion: 'Use format: /trpc/router.method',
          type: 'convention',
        });
      }
    }
  }

  private validateRoute(route: RouteInfo): void {
    this.validateRouteStructure(route);
    this.validateServiceNaming(route);
    this.validateFileStructure(route);
    this.validatePathFormats(route);
    this.validateConventions(route);
  }

  private validateRouteStructure(route: RouteInfo): void {
    if (route.path === '') {
      this.addError({
        code: 'MISSING_PATH',
        filePath: route.handlerFilePath,
        message: 'Route is missing path',
        type: 'structure',
      });
    }

    if (route.requestType === '') {
      this.addError({
        code: 'MISSING_REQUEST_TYPE',
        filePath: route.handlerFilePath,
        message: 'Route is missing requestType (HTTP/tRPC)',
        path: route.path,
        type: 'structure',
      });
    }

    const hasServiceClass = route.serviceClass !== undefined && route.serviceClass !== '';

    const hasServiceMethod = route.serviceMethod !== undefined && route.serviceMethod !== '';

    if (!(hasServiceClass && hasServiceMethod)) {
      this.addWarning({
        code: 'MISSING_SERVICE_INFO',
        filePath: route.handlerFilePath,
        message: 'Route is missing service class or method information',
        path: route.path,
        suggestion: 'Ensure route uses createRouteHandler(ServiceClass, "methodName") pattern',
        type: 'convention',
      });
    }
  }

  private validateServiceNaming(route: RouteInfo): void {
    const { serviceClass, serviceMethod } = route;

    if (!this.config.enforceServiceNaming || serviceClass === undefined || serviceClass === '') {
      return;
    }

    if (!serviceClass.endsWith('Service')) {
      this.addError({
        code: 'INVALID_SERVICE_SUFFIX',
        filePath: route.handlerFilePath,
        message: `Service class "${serviceClass}" must end with "Service"`,
        path: route.path,
        suggestion: `Rename to "${serviceClass}Service"`,
        type: 'naming',
      });
    }

    if (!/^[A-Z][a-zA-Z0-9]*Service$/.test(serviceClass)) {
      this.addError({
        code: 'INVALID_SERVICE_NAMING',
        filePath: route.handlerFilePath,
        message: `Service class "${serviceClass}" must be PascalCase`,
        path: route.path,
        suggestion: 'Use PascalCase format: MyServiceNameService',
        type: 'naming',
      });
    }

    if (
      serviceMethod !== undefined &&
      serviceMethod !== '' &&
      !/^[a-z][a-zA-Z0-9]*$/.test(serviceMethod) &&
      !serviceMethod.startsWith('_')
    ) {
      this.addWarning({
        code: 'INVALID_METHOD_NAMING',
        filePath: route.handlerFilePath,
        message: `Service method "${serviceMethod}" should be camelCase`,
        path: route.path,
        suggestion: 'Use camelCase format: myMethodName',
        type: 'naming',
      });
    }
  }

  private validateTrpcProcedureType(route: RouteInfo): void {
    const { type, serviceMethod } = route;

    if (type === undefined || type === '' || serviceMethod === undefined || serviceMethod === '') {
      return;
    }

    const normalizedServiceMethod = serviceMethod.toLowerCase();

    if (
      type === 'query' &&
      (normalizedServiceMethod.includes('create') ||
        normalizedServiceMethod.includes('update') ||
        normalizedServiceMethod.includes('delete'))
    ) {
      this.addWarning({
        code: 'TRPC_PROCEDURE_MISMATCH',
        filePath: route.handlerFilePath,
        message: `Query procedure with ${serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using mutation for side effects',
        type: 'consistency',
      });
    }

    if (type === 'mutation' && normalizedServiceMethod.startsWith('get')) {
      this.addWarning({
        code: 'TRPC_PROCEDURE_MISMATCH',
        filePath: route.handlerFilePath,
        message: `Mutation procedure with ${serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using query for read operations',
        type: 'consistency',
      });
    }
  }
}

const validateRoutes = (
  routes: RouteInfo[],
  config?: Partial<ValidationConfig>,
): ValidationResult => {
  const validator = new RouteValidator(config);

  return validator.validate(routes);
};

const validateRoutesWithLogging = (
  routes: RouteInfo[],
  config?: Partial<ValidationConfig>,
): ValidationResult => {
  const validator = new RouteValidator(config);

  const result = validator.validate(routes);

  const summary = RouteValidator.getSummary(result);

  logger.info(summary);

  return result;
};

export type { ValidationConfig, ValidationError, ValidationResult };
export { RouteValidator, validateRoutes, validateRoutesWithLogging };
