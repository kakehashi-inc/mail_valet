import { registerAllIpcHandlers } from './handlers';

export { setMainWindowRef } from './handlers';

export function registerIpcHandlers() {
    registerAllIpcHandlers();
}
