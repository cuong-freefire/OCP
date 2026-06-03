import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { createAuthRouter } from './api/auth.routes.js';
import { getAuthConfig } from './config/auth.config.js';
import { createCorsOptions } from './config/cors.config.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AuthService } from './services/auth.service.js';
import { EmailService } from './services/email.service.js';
import { GoogleAuthService } from './services/googleAuth.service.js';
import { TokenService } from './services/token.service.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { sendSuccess } from './utils/response.util.js';

export function createApp(overrides = {}) {
  const config = overrides.config || getAuthConfig(overrides.env || {});
  const repository = overrides.repository || new AuthRepository(overrides.prisma);
  const tokenService = overrides.tokenService || new TokenService(config);
  const emailService = overrides.emailService || new EmailService(config);
  const googleAuthService = overrides.googleAuthService || new GoogleAuthService(config);
  const authService =
    overrides.authService ||
    new AuthService({
      repository,
      emailService,
      tokenService,
      googleAuthService,
      config,
    });

  const app = express();
  app.locals.authConfig = config;
  app.locals.authService = authService;

  app.use(cors(createCorsOptions(config)));
  app.use(express.json());
  app.use(cookieParser());

  app.get(`${config.apiPrefix}/health`, (_req, res) => {
    sendSuccess(res, { message: 'OCP backend is running.', code: 'HEALTH_OK' });
  });
  app.use(`${config.apiPrefix}/auth`, createAuthRouter());
  app.use(errorMiddleware);

  return app;
}
