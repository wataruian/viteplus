import type { JobFunction } from '../core/function';
import { listUsers } from './list-users';
import { ping } from './ping';

const functions: readonly JobFunction[] = [listUsers, ping];
export { listUsers } from './list-users';
export { ping } from './ping';

export { functions };
