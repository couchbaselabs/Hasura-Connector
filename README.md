# Data Connector Agent for Couchbase

This directory contains a Couchbase implementation of a data connector agent.
It can use a Couchbase cluster and consume documents of a bucket as referenced by the "DB" config field.

## Capabilities

The Couchbase agent currently supports the following capabilities:

* [x] GraphQL Schema
* [x] GraphQL Queries
* [x] Prometheus Metrics
* [ ] Exposing Foreign-Key Information
* [ ] Mutations
* [ ] Subscriptions
* [ ] Streaming Subscriptions

Note: You can get detailed metadata about the agent's capabilities by
`GET`ting the `/capabilities` endpoint of the running agent.

## Requirements

* NodeJS 16
* "Couchbase": "^3.2.4" 
* Note: NPM is used for the [TS Types for the DC-API protocol](https://www.npmjs.com/package/@hasura/dc-api-types)
* Copy `.env.example` to `.env` and define your values to environment vars

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

| Property | Type | Default | Info |
| -------- | ---- | ------- | ---------- |
| `db`| `string` | | Connection string to couchbase cluster |
| `username`| `string`| | User that will be used to connect with cluster|
| `password`| `string`| |Password that will be used to connect with cluster|
| `bucket` | `string` | | Bucket that will be used from DC Agent |
| `scope` | `string` | `default` | Scope that will be used from DC Agent|
| `collection` | `string` | `default` | Collection that will be used from DC Agent |
| `healtCheckStrategy` | `string` | `null` | Strategic to check health of cluster `ping` or `diagnostic` |

The schema is exposed via introspection, but you can limit which documents are referenced by

## Dataset

The dataset used for testing the couchbase agent is sample buckets
- Travel-sample
- Beer-sample 

## [Starting with Agent](GETTING_STARTED.md)

## Testing Changes to the Agent

Run:

```sh
cabal run dc-api:test:tests-dc-api -- test --agent-base-url http://localhost:8100 --agent-config '{"bucket": "travel-sample", "healtCheckStrategy": "ping"}'
```

From the HGE repo.

## TODO

* [x] Prometheus metrics hosted at `/metrics`
* [x] Pull reference types from a package rather than checked-in files
* [x] Health Check
* [x] DB Specific Health Checks
* [x] Schema
* [x] Capabilities
* [x] Query


# Known Bugs

## Tricky Aggregates may have logic bug

Replicate by running the agent test-suite.