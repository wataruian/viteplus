import { registerScripts } from '../core/script';
import { hello } from './hello';
import { listUsers } from './list-users';
import { ping } from './ping';

const scripts = registerScripts([hello, ping, listUsers]);
export { hello } from './hello';
export { listUsers } from './list-users';
export { ping } from './ping';

export { scripts };
