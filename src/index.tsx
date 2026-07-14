import { createRoot } from 'react-dom/client';
import {
  ApplicationShell,
  setupGlobalErrorListener,
} from '@commercetools-frontend/application-shell';
import type { ApplicationWindow } from '@commercetools-frontend/constants';
import AppRoutes from './routes';

declare let window: ApplicationWindow;

setupGlobalErrorListener();

const container = document.getElementById('app');
if (!container) throw new Error('Root container #app not found');

createRoot(container).render(
  <ApplicationShell
    environment={window.app}
    onRegisterErrorListeners={() => {}}
    applicationMessages={async (_locale: string) => ({})}
  >
    <AppRoutes />
  </ApplicationShell>
);
