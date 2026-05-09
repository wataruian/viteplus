import { logger } from '@lightproject/common/logger';

import type { RouteInfo } from '../types';

/**
 * Route validation configuration
 */
interface ValidationConfig {
  enforceServiceNaming: boolean;
  requiredServiceDirectory: string;
  strictConventions: boolean;
  validateParameters: boolean;
}

/**
 * Validation error types
 */
interface ValidationError {
  code: string;
  filePath?: string | undefined;
  message: string;
  path?: string | undefined;
  severity: 'error' | 'warning';
  suggestion?: string | undefined;
  type: 'consistency' | 'convention' | 'naming' | 'structure';
}

/**
 * Validation result containing errors and warnings
 */
interface ValidationResult {
  errors: ValidationError[];
  isValid: boolean;
  warnings: ValidationError[];
}

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: ValidationConfig = {
  enforceServiceNaming: true,
  requiredServiceDirectory: '/src/services/',
  strictConventions: true,
  validateParameters: true,
};

const SERVICE_NAME_REGEX = /Service$/;
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*Service$/;
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE_METHOD_REGEX = /([A-Z])/g;
const LEADING_DASH_REGEX = /^-/;

/**
 * Comprehensive route validator for autogen system
 * Ensures routes follow expected conventions and patterns
 */
class RouteValidator {
  private readonly config: ValidationConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Format a single validation issue (error or warning)
   */
  private formatValidationIssue(issue: ValidationError): string {
    let output = `  - ${issue.code}: ${issue.message}\n`;

    if (issue.filePath) {
      output += `    File: ${issue.filePath}\n`;
    }

    if (issue.path) {
      output += `    Path: ${issue.path}\n`;
    }

    if (issue.suggestion) {
      output += `    💡 ${issue.suggestion}\n`;
    }

    return output;
  }

  /**
   * Format errors section of summary
   */
  private formatErrorsSection(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    let section = `❌ Errors: ${errors.length}\n`;
    for (const error of errors) {
      section += this.formatValidationIssue(error);
    }
    return section;
  }

  /**
   * Format warnings section of summary
   */
  private formatWarningsSection(warnings: ValidationError[]): string {
    if (warnings.length === 0) {
      return '';
    }

    let section = `⚠️  Warnings: ${warnings.length}\n`;
    for (const warning of warnings) {
      section += this.formatValidationIssue(warning);
    }
    return section;
  }

  /**
   * Get summary of validation results
   */
  getSummary(result: ValidationResult): string {
    const { errors, warnings } = result;
    const total = errors.length + warnings.length;

    if (total === 0) {
      return '✅ All routes passed validation';
    }

    let summary = `📋 Validation Summary: ${total} issues found\n`;
    summary += this.formatErrorsSection(errors);
    summary += this.formatWarningsSection(warnings);

    return summary;
  }

  /**
   * Validate all routes and return comprehensive results
   */
  validate(routes: RouteInfo[]): ValidationResult {
    this.errors = [];
    this.warnings = [];

    logger.info(`Validating ${routes.length} routes...`);

    for (const route of routes) {
      this.validateRoute(route);
    }

    const isValid = this.errors.length === 0;

    if (isValid) {
      logger.info(
        `✅ All routes passed validation (${this.warnings.length} warnings)`
      );
    } else {
      logger.warn(
        `Validation found ${this.errors.length} errors and ${this.warnings.length} warnings`
      );
    }

    return {
      errors: this.errors,
      isValid,
      warnings: this.warnings,
    };
  }

  /**
   * Add error to validation results
   */
  private addError(error: Omit<ValidationError, 'severity'>): void {
    this.errors.push({ ...error, severity: 'error' });
  }

  /**
   * Add warning to validation results
   */
  private addWarning(warning: Omit<ValidationError, 'severity'>): void {
    this.warnings.push({ ...warning, severity: 'warning' });
  }

  /**
   * Get expected service filename from class name
   */
  private getExpectedServiceFileName(serviceClass: string): string {
    // Convert PascalCase to kebab-case: UserProfileService -> user-profile.ts
    const baseName = serviceClass.replace(SERVICE_NAME_REGEX, '');
    const kebabCase = baseName
      .replaceAll(
        PASCAL_CASE_METHOD_REGEX,
        (_, letter) => `-${letter.toLowerCase()}`
      )
      .replace(LEADING_DASH_REGEX, ''); // Remove leading dash

    return `${kebabCase}.ts`;
  }

  /**
   * Validate createRouteHandler pattern usage
   */
  private validateConventions(route: RouteInfo): void {
    if (!this.config.strictConventions) {
      return;
    }

    // Routes should have both service class and method
    if (!(route.serviceClass && route.serviceMethod)) {
      this.addError({
        code: 'MISSING_ROUTE_HANDLER_PATTERN',
        filePath: route.handlerFilePath,
        message:
          'Route must use createRouteHandler(ServiceClass, "methodName") pattern',
        path: route.path,
        suggestion: 'Use: createRouteHandler(MyService, "methodName")',
        type: 'convention',
      });
    }

    // Validate HTTP method consistency
    if (route.requestType === 'HTTP' && route.method) {
      this.validateHttpMethodConsistency(route);
    }

    // Validate tRPC procedure types
    if (route.requestType === 'tRPC' && route.type) {
      this.validateTrpcProcedureType(route);
    }
  }

  /**
   * Validate file structure conventions
   */
  private validateFileStructure(route: RouteInfo): void {
    if (!route.serviceFilePath) {
      return;
    }

    // Check if service is in correct directory
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

    // Validate service filename matches class name
    if (route.serviceClass) {
      const expectedFileName = this.getExpectedServiceFileName(
        route.serviceClass
      );
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

  /**
   * Validate HTTP method consistency
   */
  private validateHttpMethodConsistency(route: RouteInfo): void {
    if (!(route.method && route.serviceMethod)) {
      return;
    }

    const method = route.method.toLowerCase();
    const serviceMethod = route.serviceMethod.toLowerCase();

    // Common patterns validation
    if (
      method === 'get' &&
      (serviceMethod.includes('create') ||
        serviceMethod.includes('update') ||
        serviceMethod.includes('delete'))
    ) {
      this.addWarning({
        code: 'HTTP_METHOD_MISMATCH',
        filePath: route.handlerFilePath,
        message: `GET method with ${route.serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using POST/PUT/DELETE for mutations',
        type: 'consistency',
      });
    }

    if (
      (method === 'post' || method === 'put') &&
      serviceMethod.startsWith('get')
    ) {
      this.addWarning({
        code: 'HTTP_METHOD_MISMATCH',
        filePath: route.handlerFilePath,
        message: `${method.toUpperCase()} method with ${route.serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using GET for queries',
        type: 'consistency',
      });
    }
  }

  /**
   * Validate route path formats
   */
  private validatePathFormats(route: RouteInfo): void {
    if (!(route.path && route.requestType)) {
      return;
    }

    if (route.requestType === 'HTTP') {
      // HTTP paths should start with / but not /trpc
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
      // tRPC paths should start with /trpc/
      if (!route.path.startsWith('/trpc/')) {
        this.addError({
          code: 'INVALID_TRPC_PATH',
          filePath: route.handlerFilePath,
          message: 'tRPC route path must start with /trpc/',
          path: route.path,
          type: 'convention',
        });
      }

      // tRPC paths should use dot notation
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

  /**
   * Validate individual route
   */
  private validateRoute(route: RouteInfo): void {
    this.validateRouteStructure(route);
    this.validateServiceNaming(route);
    this.validateFileStructure(route);
    this.validatePathFormats(route);
    this.validateConventions(route);
  }

  /**
   * Validate basic route structure
   */
  private validateRouteStructure(route: RouteInfo): void {
    // Allow empty string paths for root routes (handles both '' and '/' patterns)
    if (route.path === undefined || route.path === null) {
      this.addError({
        code: 'MISSING_PATH',
        filePath: route.handlerFilePath,
        message: 'Route is missing path',
        type: 'structure',
      });
    }

    if (!route.requestType) {
      this.addError({
        code: 'MISSING_REQUEST_TYPE',
        filePath: route.handlerFilePath,
        message: 'Route is missing requestType (HTTP/tRPC)',
        path: route.path,
        type: 'structure',
      });
    }

    if (!(route.serviceClass && route.serviceMethod)) {
      this.addWarning({
        code: 'MISSING_SERVICE_INFO',
        filePath: route.handlerFilePath,
        message: 'Route is missing service class or method information',
        path: route.path,
        suggestion:
          'Ensure route uses createRouteHandler(ServiceClass, "methodName") pattern',
        type: 'convention',
      });
    }
  }

  /**
   * Validate service class naming conventions
   */
  private validateServiceNaming(route: RouteInfo): void {
    if (!(this.config.enforceServiceNaming && route.serviceClass)) {
      return;
    }

    // Check PascalCase + "Service" suffix
    if (!route.serviceClass.endsWith('Service')) {
      this.addError({
        code: 'INVALID_SERVICE_SUFFIX',
        filePath: route.handlerFilePath,
        message: `Service class "${route.serviceClass}" must end with "Service"`,
        path: route.path,
        suggestion: `Rename to "${route.serviceClass}Service"`,
        type: 'naming',
      });
    }

    // Check PascalCase format
    if (!PASCAL_CASE_REGEX.test(route.serviceClass)) {
      this.addError({
        code: 'INVALID_SERVICE_NAMING',
        filePath: route.handlerFilePath,
        message: `Service class "${route.serviceClass}" must be PascalCase`,
        path: route.path,
        suggestion: 'Use PascalCase format: MyServiceNameService',
        type: 'naming',
      });
    }

    // Validate service method naming
    if (
      route.serviceMethod &&
      !CAMEL_CASE_REGEX.test(route.serviceMethod) &&
      !route.serviceMethod.startsWith('_')
    ) {
      this.addWarning({
        code: 'INVALID_METHOD_NAMING',
        filePath: route.handlerFilePath,
        message: `Service method "${route.serviceMethod}" should be camelCase`,
        path: route.path,
        suggestion: 'Use camelCase format: myMethodName',
        type: 'naming',
      });
    }
  }

  /**
   * Validate tRPC procedure type consistency
   */
  private validateTrpcProcedureType(route: RouteInfo): void {
    if (!(route.type && route.serviceMethod)) {
      return;
    }

    const procedureType = route.type;
    const serviceMethod = route.serviceMethod.toLowerCase();

    if (
      procedureType === 'query' &&
      (serviceMethod.includes('create') ||
        serviceMethod.includes('update') ||
        serviceMethod.includes('delete'))
    ) {
      this.addWarning({
        code: 'TRPC_PROCEDURE_MISMATCH',
        filePath: route.handlerFilePath,
        message: `Query procedure with ${route.serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using mutation for side effects',
        type: 'consistency',
      });
    }

    if (procedureType === 'mutation' && serviceMethod.startsWith('get')) {
      this.addWarning({
        code: 'TRPC_PROCEDURE_MISMATCH',
        filePath: route.handlerFilePath,
        message: `Mutation procedure with ${route.serviceMethod} may indicate semantic mismatch`,
        path: route.path,
        suggestion: 'Consider using query for read operations',
        type: 'consistency',
      });
    }
  }
}

/**
 * Convenience function to validate routes with default configuration
 */
const validateRoutes = (
  routes: RouteInfo[],
  config?: Partial<ValidationConfig>
): ValidationResult => {
  const validator = new RouteValidator(config);
  return validator.validate(routes);
};

/**
 * Validate routes and log results
 */
const validateRoutesWithLogging = (
  routes: RouteInfo[],
  config?: Partial<ValidationConfig>
): ValidationResult => {
  const validator = new RouteValidator(config);
  const result = validator.validate(routes);

  const summary = validator.getSummary(result);
  console.log(`\n${summary}`);

  return result;
};

export type { ValidationConfig, ValidationError, ValidationResult };
export { RouteValidator, validateRoutes, validateRoutesWithLogging };
