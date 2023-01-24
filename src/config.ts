import { FastifyRequest } from "fastify"
import { ConfigSchemaResponse } from "@hasura/dc-api-types"

export type DocumentReference = {
  field_mapping: Record<string, string>,
  target_document: string
}

export type Document = {
  name: string,
  relations: DocumentReference[] | null
}

export type Config = {
  bucket: string,
  db: string,
  username: string,
  password: string,
  scope: string | '_default',
  collection: string  | '_default',
  documents:  Document[] | null, 
  healtCheckStrategy: 'ping' | 'diagnostic' | null,
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

  if(config.db == null) {
    return null;
  }

  if(config.username == null) {
    return null;
  }

  if(config.password == null) {
    return null;
  }

  return {
    bucket: config.bucket,
    db: config.db,
    username: config.username,
    password: config.password,
    scope: config.scope ?? '_default',
    collection: config.collection ?? '_default',
    healtCheckStrategy: config.healtCheckStrategy,
    documents: config.documents,
  }
}

export const configSchema: ConfigSchemaResponse = {
  config_schema: {
    type: "object",
    nullable: false,
    required: ["db", "username", "password", "bucket"],
    properties: {
      db: {
        description: "The connection string to access to DB",
        type: "string",
      },
      username: {
        description: "User will be use to connect to couchbase",
        type: "string",
      },
      password: {
        description: "Password will be use to connect to couchbase",
        type: "string",
      },
      bucket: {
        description: "The Couchbase bucket.",
        type: "string"
      },
      scope: {
        description: "Scope of collections",
        type: "string",
        default: "_default",
      },
      collection: {
        description: "Collection to make available in the schema and for querying",
        type: "string",
        default: "_default",
        nullable: true
      },
      documents: {
        description: "A list of documents and the relations allowed",
        type: "object",
        nullable: true
      },
      healtCheckStrategy: {
        description: "Define strategic to healt check of couchbase",
        nullable: true,
        default: null,
        type: "string",
      },
    }
  },
  other_schemas: {}
}
