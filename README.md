# Data Connector Agent for Couchbase

This directory contains a Couchbase implementation of a data connector agent.
It can use a Couchbase cluster and consume documents of a bucket as referenced by the "DB" config field.

## Capabilities

The Couchbase agent currently supports the following capabilities:

* [x] GraphQL Schema
* [ ] 20% GraphQL Queries
* [ ] Prometheus Metrics
* [ ] Exposing Foreign-Key Information
* [ ] Mutations
* [ ] Subscriptions
* [ ] Streaming Subscriptions

Note: You are able to get detailed metadata about the agent's capabilities by
`GET`ting the `/capabilities` endpoint of the running agent.

## Requirements

* NodeJS 16
* "Couchbase": "^3.2.4" or compiled in JSON support
    * Required for the json_group_array() and json_group_object() aggregate SQL functions
    * https://www.sqlite.org/json1.html#jgrouparray
* Note: NPM is used for the [TS Types for the DC-API protocol](https://www.npmjs.com/package/@hasura/dc-api-types)

## Build & Run

```sh
npm install
npm run build
npm run start
```

Or a simple dev-loop via `entr`:

```sh
echo src/**/*.ts | xargs -n1 echo | DB_READONLY=y entr -r npm run start
```

## Docker Build & Run

```
> docker build . -t dc-couchbase-agent:latest
> docker run -it --rm -p 8100:8100 dc-couchbase-agent:latest
```

## Options / Environment Variables

Note: Boolean flags `{FLAG}` can be provided as `1`, `true`, `yes`, or omitted and default to `false`.

| ENV Variable Name | Format | Default | Info |
| --- | --- | --- | --- |
| `PORT` | `INT` | `8100` | Port for agent to listen on. |
| `PERMISSIVE_CORS` | `{FLAG}` | `false` | Allows all requests - Useful for testing with SwaggerUI. Turn off on production. |
| `DEBUGGING_TAGS` | `{FLAG}` | `false` | Outputs xml style tags in query comments for deugging purposes. |
| `LOG_LEVEL` | `fatal` \| `error` \| `info` \| `debug` \| `trace` \| `silent` | `info` | The minimum log level to output |
| `METRICS` | `{FLAG}` | `false` | Enables a `/metrics` prometheus metrics endpoint.

## Agent usage

The agent is configured as per the configuration schema. The valid configuration properties are:

| Property | Type | Default |
| -------- | ---- | ------- |
| `db` | `string` | |
| `documents` | `string[]` | `null` |

The only required property is `db` which specifies a local sqlite database to use.

The schema is exposed via introspection, but you can limit which tables are referenced by

* Explicitly enumerating them via the `documents` property

## Dataset

The dataset used for testing the reference agent is sourced from:

// TODO

## Testing Changes to the Agent

Run:

```sh
cabal run dc-api:test:tests-dc-api -- test --agent-base-url http://localhost:8100 --agent-config '{"db": "travel-sample"}'
```

From the HGE repo.

## TODO

* [ ] Prometheus metrics hosted at `/metrics`
* [ ] Pull reference types from a package rather than checked-in files
* [ ] Health Check
* [ ] DB Specific Health Checks
* [x] Schema
* [x] Capabilities
* [ ] 20% Query
* [ ] Ensure everything is escaped correctly - https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-method-escape
* [ ] Or... Use parameterized queries if possible - https://sequelize.org/docs/v6/core-concepts/raw-queries/#bind-parameter
* [ ] Run test-suite from SDK
* [ ] Add ENV Variable for restriction on what databases can be used
* [ ] Fix SDK Test suite to be more flexible about descriptions
* [ ] Check that looped exist check doesn't cause name conflicts

# Known Bugs

## Tricky Aggregates may have logic bug

Replicate by running the agent test-suite.