

# Data Connectors

This document describes the specification of the DC Couchbase Agent that needs to be used with the new feature (data connectors from Hasura `graphql-engine`, which is under active development)

The data connectors feature allows `graphql-engine` to delegate the execution of operations to external web services called _agents_. Such agents provide access to a data set, allowing `graphql-engine` to query that data set over a web API.

This document specifies the behavior of the agent for Couchbase.

## Stability

This specification is complete with regards to the current implementation. However it but should be considered _unstable_ until the Data Connectors feature is officially released and explicitly marked as a non-experimental feature.

# Build & Run

First, make a copy of the `.env.example` file to the `.env` file with the last updated values

```sh
cp .env.example .env
```

## Automated setup using Docker Compose

Start an instance of Couchbase and Hasura Graphql Engine (HGE, with the
experimental feature) to allow the DC agent and HGE to connect.

``` sh
docker-compose up --build -d
```

The username and password to connect to the Couchbase Cluster can be found in the docker-compose.yml file.  The couchbase-server will automatically start up, create a cluster with the provided username and password, and load the `travel-sample` bucket.

The table should now be available in the GraphiQL console. By default this is hosted at `localhost:8080`. You should be able to issue queries via the web service. For example:

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

## Manual setup

# Using CLI

Once an agent is running, edit the following metadata located in `@/opt/couchbase/init/metadata.json` and import it into `graphql-engine` using the the Docker terminal for couchbase-server using the command: 

```sh
  /opt/couchbase/bin/curl -v -d "@/opt/couchbase/init/metadata.json" http://hasura:8080/v1/metadata
```

The `backend_configs.dataconnector` section lets you set the URIs for as many agents as you'd like. In this case, we've defined one called "couchbase". When you create a source, the `kind` of the source should be set to the name you gave the agent in the `backend_configs.dataconnector` section (in this case, "couchbase").

The `configuration` property under the source can contain an 'arbitrary' JSON object, and this JSON will be sent to the agent on every request via the `X-Hasura-DataConnector-Config` header. The example here is the configuration that the couchbase agent uses. The JSON object must conform to the schema specified by the agent from its `/capabilities` endpoint.

The `name` property under the source will be sent to the agent on every request via the `X-Hasura-DataConnector-SourceName` header. This name uniquely identifies a source within an instance of HGE.

The `kind` property under the source should be the name of the dataconnector defined under backend_configs, in this case `couchbase`

The `tables` property defines the tables that are tracked with Hasura.

The `configuration.value` property defines the Couchbase database. Fill in the values with the details of your Couchbase database. `scope` and `collection` will default to `_default` if left undefined.

```json
{
  "type": "replace_metadata",
  "version": 1,
  "args": {
    "allow_warnings": true,
    "allow_inconsistent_metadata": true,
    "metadata": {
      "version": 3,
      "backend_configs": {
        "dataconnector": {
          "couchbase": {
            "uri": "http://couchbase-agent:8100" // URI of the couchbase agent
          }
        }
      },
      "sources": [
        {
          "name": "couchbase",
          "kind": "couchbase",
          "tables": [ 
            {
              "table": "Airline", // Collections to be tracked by HGE
              "object_relationships": []
            }
          ],
          "configuration": {
            "value": {
              "db": "db1", // URI of the couchbase database
              "username": "Administrator",
              "password": "Passw0rd$12",
              "bucket": "travel-sample",
              "scope": "inventory",
              "collection": "airline"
            }
          }
        }
      ]
    }
  }
}
```

# Using UI
You can also setup the agent through the Hasura UI hosted by default at `http://localhost:8080/console`

# Data
The Couchbase data connector should be already set up by default under the Data tab on the console. 

To add more databases, click connect database on the Data tab and select `couchbase`. Fill out the configuration with your Couchbase database details and click `Connect Database`.

By default, the tables in your newly added database will be untracked and you will not be able to start querying by default. To track tables, click View Database, and click track under the Table.

# Metadata
You can import and export the metadata through the Settings icon on the console. For example

```
{
  "version": 3,
  "backend_configs": {
    "dataconnector": {
      "couchbase": {
        "uri": "http://couchbase-agent:8100" // URI of the couchbase agent
      }
    }
  },
  "sources": [
    {
      "name": "couchbase",
      "kind": "couchbase",
      "tables": [ 
        {
          "table": "Airline", // Collections to be tracked by HGE
          "object_relationships": []
        }
      ],
      "configuration": {
        "value": {
          "db": "db1", // URI of the couchbase database
          "username": "Administrator",
          "password": "Passw0rd$12",
          "bucket": "travel-sample",
          "scope": "inventory",
          "collection": "airline"
        }
      }
    }
  ]
}
```