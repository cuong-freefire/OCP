export function createCorsOptions(config) {
  return {
    origin(origin, callback) {
      if (!origin || origin === config.frontendOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin is not allowed'));
    },
    credentials: true,
  };
}
