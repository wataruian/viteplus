import { registerScripts } from '../core/script';
import { listUsers } from './list-users';
import { ping } from './ping';

const scripts = registerScripts([ping, listUsers]);
export { listUsers } from './list-users';
export { ping } from './ping';

export { scripts };
