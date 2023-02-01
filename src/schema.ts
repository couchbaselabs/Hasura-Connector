import { ColumnInfo, Constraint, SchemaResponse, TableInfo } from "@hasura/dc-api-types";
import { Cluster } from "couchbase";
import { Config } from "./config";

const inferQuery = (bucket: string, scope: string, collection: string): string => {
  return `INFER \`${bucket}\`.\`${scope}\`.\`${collection}\``;
}

export async function getSchema(config: Config, cluster: Cluster, logger: any): Promise<SchemaResponse> {

  const tables: TableInfo[] = [];
  let result = await cluster.query(inferQuery(config.bucket, config.scope, config.collection));
  let schemaInfo = result.rows[0];

  for (const k in schemaInfo) {
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
          logger.debug(type);
        }
      }

      columns.push({
        name: key,
        nullable: nullable,
        type: type,
      });
    }

    const tname = properties.type.samples.map((str: any) => str.charAt(0).toUpperCase() + str.slice(1));
    let tinfo = config.documents?.filter((doc) => doc.name.toLocaleLowerCase() == tname.join(".").toLocaleLowerCase())[0];

    let foreign_keys :  [string, Constraint][] = [];
    if (tinfo?.relations != undefined) {
      foreign_keys = tinfo!.relations!.flatMap((value) => {
        return [[
          `${tname} -> ${value.target_document}`,
        {
            column_mapping: value.field_mapping,
            foreign_table: [value.target_document],
        }]];
      });
    }

    let foreignKeys :  Record<string, Constraint> = {};

    foreign_keys.forEach(value => foreignKeys[value[0]] = value[1]);
    
    let table: TableInfo = {
      name: tname,
      columns: columns,
      primary_key: ["id"],
      foreign_keys: foreignKeys,
    }
    tables.push(table)
  }

  return {
    tables: tables
  };
};
