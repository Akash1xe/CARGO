const TEST_DATABASE_PATTERN = /(?:^|[_-])test(?:$|[_-])/i;

function databaseName(databaseUrl) {
     try {
          return new URL(databaseUrl).pathname.replace(/^\//, '');
     } catch {
          return '';
     }
}

function assertSafeTestEnvironment(env = process.env) {
     if (env.NODE_ENV !== 'test') throw new Error('Refusing to run: NODE_ENV must equal test');

     const databaseUrls = Object.entries(env)
          .filter(([key, value]) => key.endsWith('DATABASE_URL') && value)
          .map(([key, value]) => [key, databaseName(value)]);

     if (databaseUrls.length === 0) throw new Error('Refusing to run: no test database URL was supplied');
     for (const [key, name] of databaseUrls) {
          if (!TEST_DATABASE_PATTERN.test(name)) {
               throw new Error(`Refusing to run: ${key} database name must clearly contain _test`);
          }
     }

     const redisUrl = new URL(env.REDIS_URL || 'redis://localhost:6379/0');
     const redisDatabase = Number(redisUrl.pathname.replace(/^\//, '') || 0);
     if (!Number.isInteger(redisDatabase) || redisDatabase <= 0) {
          throw new Error('Refusing to run: tests require a dedicated non-zero Redis database');
     }
     if (env.PAYMENT_GATEWAY !== 'mock') throw new Error('Refusing to run: PAYMENT_GATEWAY must equal mock');
     if (env.SEND_EMAILS !== 'false') throw new Error('Refusing to run: SEND_EMAILS must equal false');
     return { databaseUrls, redisDatabase };
}

module.exports = { assertSafeTestEnvironment, databaseName };
