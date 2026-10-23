import type { JobFunction } from '../core/function';
import { ping } from './ping';

const functions: readonly JobFunction[] = [ping];
export { ping } from './ping';

export { functions };
