const { assertSafeTestEnvironment } = require('./helpers/safe-test-env');

if (process.env.RUN_CARGOFLOW_E2E !== '1') {
     console.log('SKIP E2E tests: set RUN_CARGOFLOW_E2E=1 with isolated test infrastructure.');
     process.exit(0);
}

assertSafeTestEnvironment();
throw new Error('E2E harness is guarded but the full workflow is not implemented yet.');
