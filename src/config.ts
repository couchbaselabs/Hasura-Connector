import { FastifyRequest } from "fastify"
import { ConfigSchemaResponse } from "@hasura/dc-api-types"

export type Config = {
  bucket: string,
  scope: string | '_defualt',
  collection: string  | '_defualt'
}

export const getConfig = (request: FastifyRequest): Config => {
  const config = tryGetConfig(request);
  if (config === null) {
    throw new Error("X-Hasura-DataConnector-Config header must specify db");
  }
  return config;
}

export const tryGetConfig = (request: FastifyRequest): Config | null => {
  const configHeader = request.headers["x-hasura-dataconnector-config"];
  const rawConfigJson = Array.isArray(configHeader) ? configHeader[0] : configHeader ?? "{}";
  const config = JSON.parse(rawConfigJson);

  if(config.bucket == null) {
    return null;
  }

  return {
    bucket: config.bucket,
    scope: config.scope ?? '_default',
    collection: config.collection ?? '_default',
  }
}

export const configSchema: ConfigSchemaResponse = {
  config_schema: {
    type: "object",
    nullable: false,
    required: ["bucket"],
    properties: {
      bucket: {
        description: "The Couchbase bucket.",
        type: "string"
      },
      scope: {
        description: "Scope of collections",
        type: "string",
        default: "default",
      },
      collections: {
        description: "List of collections to make available in the schema and for querying",
        type: "array",
        items: { $ref: "#/other_schemas/Collections" },
        nullable: true
      },
      DEBUG: {
        description: "For debugging.",
        type: "object",
        additionalProperties: true,
        nullable: true
      }
    }
  },
  other_schemas: {
    Collections: {
      nullable: false,
      type: "string"
    }
  }
}
