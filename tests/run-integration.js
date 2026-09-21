const { assertSafeTestEnvironment } = require('./helpers/safe-test-env');

if (process.env.RUN_CARGOFLOW_INTEGRATION !== '1') {
     console.log('SKIP integration tests: set RUN_CARGOFLOW_INTEGRATION=1 with isolated test infrastructure.');
     process.exit(0);
}

assertSafeTestEnvironment();
throw new Error('Integration harness is guarded but full infrastructure tests are not implemented yet.');
