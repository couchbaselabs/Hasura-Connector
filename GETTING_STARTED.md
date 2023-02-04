# Build & Run

First make a copy of `.env.example` file to `.env` later update values

```sh
cp .env.example .env
```

## Build & Run with NPM

```sh
npm install
npm run build
npm run start
```

Or a simple dev-loop via `entr`:

```sh
echo src/**/*.ts | xargs -n1 echo | PORT=8100 entr -r npm run start
```

## Docker Build & Run

```
> docker build . -t dc-couchbase-agent:latest
> docker run -it --rm -p 8100:8100 dc-couchbase-agent:latest
```

**Note**: In this case will be asume that `PORT` was no changed in `.env` or regriter when run docker container.

## Compose docker 

``` sh
docker-compose up --build -d
```
**Note**: In this case will be start a instance of couchbase and Hasura Graphql Engine (HGE, with experimental feature) to allow connect DC agent and HGE

# Data Connectors

This document describes the current specification of the DC Couchbase Agent to use with the new feature (data connectors from Hasura `graphql-engine`, which is under active development)

The data connectors feature allows `graphql-engine` to delegate the execution of operations to external web services called _agents_. Such agents provide access to a data set, allowing `graphql-engine` to query that data set over a web API.

This document specifies the precise behavior of the agent for Couchbase.

## Stability

This specification is complete with regards to the current implementation, but should be considered _unstable_ until the Data Connectors feature is officially released and explicitly marked as a non-experimental feature.

## Setting up Data Connector agents with `graphql-engine`

In order to run one of the example agents, follow the steps in its respective README document.

Once an agent is running, import the following metadata into `graphql-engine`:

```json
POST /v1/metadata

{
  "type": "replace_metadata",
  "args": {
    "metadata": {
      "version": 3,
      "backend_configs": {
        "dataconnector": {
          "couchbase": {
            "uri": "http://agent:8100"
          }
        }
      },
      "sources": [
        {
          "name": "couchbase",
          "kind": "couchbase",
          "tables": [
            {
              "table": "Route",
              "object_relationships": [
                  {
                  "name": "Airline",
                  "using": {
                    "manual_configuration": {
                      "remote_table": ["Airline"],
                      "column_mapping": {
                        "airlineid": "id"
                      }
                    }
                  }
                }
              ]
            },
            {
              "table": "Airline",
              "object_relationships": []
            }
          ],
          "configuration":  {
            "value":{
                "db":"couchbase://localhost",
                "username": "Administrator", 
                "password": "Password", 
                "bucket": "travel-sample"
                
            }
          }
        }
      ]
    }
  }
}
```

The `backend_configs.dataconnector` section lets you set the URIs for as many agents as you'd like. In this case, we've defined one called "couchbase". When you create a source, the `kind` of the source should be set to the name you gave the agent in the `backend_configs.dataconnector` section (in this case, "couchbase").

The `configuration` property under the source can contain an 'arbitrary' JSON object, and this JSON will be sent to the agent on every request via the `X-Hasura-DataConnector-Config` header. The example here is the configuration that the couchbase agent uses. The JSON object must conform to the schema specified by the agent from its `/capabilities` endpoint.

The `name` property under the source will be sent to the agent on every request via the `X-Hasura-DataConnector-SourceName` header. This name uniquely identifies a source within an instance of HGE.

The `Route` and `Airlines` tables should now be available in the GraphiQL console. You should be able to issue queries via the web service. For example:


```graphql
query {
  Route {
    id
    Airline {
      id
      name
    }
  }
}
```