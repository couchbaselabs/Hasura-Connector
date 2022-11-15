import { ColumnInfo, SchemaResponse, TableInfo } from "@hasura/dc-api-types";
import { Cluster } from "couchbase";
import { Config } from "./config";

const inferQuery = (bucket: string, scope: string, collection: string): string => {
  return `INFER \`${bucket}\`.\`${scope}\`.\`${collection}\``;
}
export async function getSchema(config: Config, cluster: Cluster, logger: any): Promise<SchemaResponse> {

  const tables: TableInfo[] = [];
  let result = await cluster.query(inferQuery(config.bucket, config.scope, config.collection));
  let schemaInfo = result.rows[0];

  logger.info(schemaInfo);
  for (const k in schemaInfo) {
    logger.info(schemaInfo[k]);
    let properties = schemaInfo[k].properties;
    let columns: ColumnInfo[] = [{
      name: 'id',
      nullable: false,
      type: 'string',
    }];

    for (const key in properties) {
      let type = properties[key].type;
      let nullable = false;
      if (properties[key].type instanceof Array) {
        let index = properties[key].type.indexOf("null");
        if (index != -1) {
          nullable = true;
          properties[key].type.splice(index, 1);
          type = properties[key].type[0];
          logger.info(type);
        }
      }
      logger.info(key);
      columns.push({
        name: key,
        nullable: nullable,
        type: type,
      });
    }

    let table: TableInfo = {
      name: properties.type.samples.map((str: any) => str.charAt(0).toUpperCase() + str.slice(1)),
      columns: columns,
    }
    tables.push(table)
  }

  return {
    tables: tables
  };
};
