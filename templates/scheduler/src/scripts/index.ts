import { registerScripts } from '../core/script';
import { ping } from './ping';

const scripts = registerScripts([ping]);
export { ping } from './ping';

export { scripts };
