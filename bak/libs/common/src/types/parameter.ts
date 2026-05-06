/**
 * Shared parameter type definitions used by both runtime (invoker) and build-time (autogen)
 * This ensures consistency between how we extract parameters at runtime vs how we document them
 */

/**
 * Basic parameter information - used by runtime invoker
 * Lightweight, contains only what's needed for function invocation
 */
export interface ParameterInfo {
  /** Parameter name extracted from function signature */
  name: string;
}

/**
 * Extended parameter metadata - used by build-time autogen
 * Includes TypeScript type information, JSDoc, and other documentation details
 */
export interface ParameterMetadata extends ParameterInfo {
  /** Default value if parameter is optional */
  defaultValue?: boolean | number | string | undefined | unknown[];

  /** JSDoc description extracted from @param tag */
  description?: string | undefined;

  /** For object parameters, nested property metadata */
  properties?: ParameterMetadata[] | undefined;

  /** Whether the parameter is required (not optional) */
  required: boolean;

  /** TypeScript type as string (e.g., "string", "number", "UserProfile") */
  type: string;
}
