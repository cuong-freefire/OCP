import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { createAuthRouter } from './api/auth.routes.js';
import { createQuizRouter } from './api/quiz.routes.js';
import { getAuthConfig } from './config/auth.config.js';
import { createCorsOptions } from './config/cors.config.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AuthService } from './services/auth.service.js';
import { EmailService } from './services/email.service.js';
import { GoogleAuthService } from './services/googleAuth.service.js';
import { TokenService } from './services/token.service.js';
import { QuizRepository } from './repositories/quiz.repository.js';
import { QuizService } from './services/quiz.service.js';
import { CourseAccessService } from './services/courseAccess.service.js';
import { ScoringService } from './services/scoring.service.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { sendSuccess } from './utils/response.util.js';

export function createApp(overrides = {}) {
  const config = overrides.config || getAuthConfig(overrides.env || {});
  const prisma = overrides.prisma;
  const repository = overrides.repository || new AuthRepository(prisma);
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

  // Quiz module dependencies
  const quizRepository = overrides.quizRepository || (prisma ? new QuizRepository(prisma) : null);
  const courseAccessService = overrides.courseAccessService || (prisma ? new CourseAccessService(prisma) : null);
  const scoringService = overrides.scoringService || new ScoringService();
  const quizService =
    overrides.quizService ||
    (quizRepository && courseAccessService
      ? new QuizService({ repository: quizRepository, courseAccessService, scoringService, config })
      : null);

  const app = express();
  app.locals.authConfig = config;
  app.locals.authService = authService;
  app.locals.quizService = quizService;
  app.locals.prisma = prisma;

  app.use(cors(createCorsOptions(config)));
  app.use(express.json());
  app.use(cookieParser());

  app.get(`${config.apiPrefix}/health`, (_req, res) => {
    sendSuccess(res, { message: 'OCP backend is running.', code: 'HEALTH_OK' });
  });
  app.use(`${config.apiPrefix}/auth`, createAuthRouter());
  if (quizService) {
    app.use(`${config.apiPrefix}/quizzes`, createQuizRouter());
  }
  app.use(errorMiddleware);

  return app;
}
