import { createApp } from './app.js';
import { authConfig } from './config/auth.config.js';
import { prisma } from './config/prisma.config.js';

const app = createApp({ config: authConfig, prisma });

app.listen(authConfig.port, () => {
  // Keep startup output free of secrets and cookie values.
  console.info(`OCP backend listening on port ${authConfig.port}`);
});