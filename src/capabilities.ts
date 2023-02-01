import { configSchema } from "./config"
import { CapabilitiesResponse } from "@hasura/dc-api-types"
import { envToBool } from "./utils"

export const capabilitiesResponse: CapabilitiesResponse = {
  config_schemas: configSchema,
  capabilities: {
    data_schema: {
      supports_primary_keys: false,
      supports_foreign_keys: false,
      column_nullability: "nullable_and_non_nullable",
    },
    scalar_types: {
      DateTime: {}
    },
    queries: {},
    relationships: {},
    comparisons: {
      subquery: {
        supports_relations: true
      }
    },
    explain: {},
    raw: {},
    ... ( envToBool('METRICS') ?  { metrics: {} } : {} )
  },
}
