# CargoFlow Testing

## Scope and categories

CargoFlow uses Node's built-in `node:test` runner. The root `package.json` is a private test orchestrator and does not change service boundaries.

- Unit tests exercise pure validation, authentication claims and roles, the API Gateway circuit breaker, segment-overlap rules, notification rendering and the isolated mock payment adapter.
- Integration tests are reserved for PostgreSQL, Redis, Kafka and Elasticsearch behavior with isolated test resources.
- End-to-end tests are reserved for the complete Admin-to-customer shipment workflow.

The frontend conversion is intentionally deferred by the project owner. Frontend tests and frontend build verification are therefore outside the current backend-only phase.

## Required software

- Node.js 20 or newer
- npm
- Docker Desktop and Docker Compose for integration/E2E runs
- Dedicated PostgreSQL databases, a dedicated Redis database, test Elasticsearch indices and test Kafka consumer groups

## Safe test environment

Copy `.env.test.example` to a local, ignored test environment file and replace only test credentials. Never copy production secrets into test configuration.

Safety guards require:

- `NODE_ENV=test`
- every configured database name to clearly contain `_test`
- a non-zero Redis database number
- `PAYMENT_GATEWAY=mock`
- `SEND_EMAILS=false`

The guarded runners abort before doing work when these conditions are not met. Test cleanup must target only known test databases, test-index names and namespaced Redis keys. Never use Redis `FLUSHALL`, delete arbitrary Kafka topics or reset a non-test database.

## Commands

```text
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:all
```

Unit tests run offline. Integration and E2E runners print an explicit skip unless `RUN_CARGOFLOW_INTEGRATION=1` or `RUN_CARGOFLOW_E2E=1` is supplied. Those opt-ins still run the safety guard first.

The full infrastructure harness is not yet implemented. If an opt-in flag is supplied today, the runner stops with a clear error rather than reporting false success.

## Mock payment behavior

Select `PAYMENT_GATEWAY=mock` only with `NODE_ENV=test`. The adapter creates deterministic order IDs, deterministic payment and webhook signatures, captured/failed payment responses and deterministic refunds without network calls. Both the factory and adapter reject use outside the test environment. Production continues to default to Razorpay.

## Email isolation

Unit tests render templates directly and exercise missing-email skip behavior. They do not start notification-service, call SendGrid or use a SendGrid key. Infrastructure tests must retain `SEND_EMAILS=false` and replace delivery with a test observer before they are enabled.

## Concurrency tests

Concurrency verification requires real isolated PostgreSQL and Redis instances. Run simultaneous requests against one trip/capacity unit and an overlapping segment, assert exactly one lock succeeds, then query inventory and payment test databases for consistency. Repeat with adjacent half-open segments such as `[1,3)` and `[3,5)`, which may both succeed. Use bounded polling and explicit timeouts; never wait indefinitely.

This scenario remains a documented coverage gap until the integration harness provisions and tears down isolated resources safely.

## Expected E2E duration

Allow approximately two to five minutes after isolated containers are healthy. Kafka and Elasticsearch convergence must use bounded polling with a clear timeout.

## Mocked versus real

Unit tests mock or isolate Razorpay, SendGrid delivery and external infrastructure. Integration tests should use real test PostgreSQL, Redis, Kafka and Elasticsearch instances. E2E should use the mock payment gateway and an email observer while exercising real service APIs and message flows.

## Troubleshooting

- A `_test` database error means at least one database URL points to an unsafe name.
- A Redis error means the URL selects database `0` or has no dedicated database number.
- A mock-gateway error outside tests is intentional protection.
- Docker named-pipe errors mean Docker Desktop is not running.
- Prisma validation can run without a live database, but applying migrations requires reachable test databases.
- This workspace currently lacks `.git`, so Git status and diff checks require restoring the repository metadata first.
