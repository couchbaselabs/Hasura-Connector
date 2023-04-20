import {
  ColumnInfo,
  Constraint,
  SchemaResponse,
  TableInfo,
} from "@hasura/dc-api-types";
import { Cluster } from "couchbase";
import { Config } from "./config";
import { tableNameEquals } from "./utils";

const inferQuery = (
  bucket: string,
  scope: string,
  collection: string
): string => {
  return `INFER \`${bucket}\`.\`${scope}\`.\`${collection}\``;
};

export async function getSchema(
  config: Config,
  cluster: Cluster,
  logger: any
): Promise<SchemaResponse> {
  const tables: TableInfo[] = [];
  let scopes = await cluster.bucket(config.bucket).collections().getAllScopes();

  console.log(scopes);
  for (const scope of scopes) {
    for (const collection of scope.collections) {
      let result;
      const tname = [scope.name, collection.name];

      for (const table of tables) {
        if (tableNameEquals(table.name)(tname)) {
          continue;
        }
      }

      try {
        result = await cluster.query(
          inferQuery(config.bucket, scope.name, collection.name)
        );
      } catch (error) {
        // Ignore error infers
        continue;
      }

      let schemaInfo = result.rows.at(0);

      for (const collectionMetadata of schemaInfo) {
        let properties = collectionMetadata.properties;
        let columns: ColumnInfo[] = [
          {
            name: "id",
            nullable: false,
            type: "string",
          },
        ];

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

        let tinfo = config.documents?.filter(
          (doc) =>
            doc.name.toLocaleLowerCase() == tname.join(".").toLocaleLowerCase()
        )[0];

        let foreign_keys: [string, Constraint][] = [];
        if (tinfo?.relations != undefined) {
          foreign_keys = tinfo!.relations!.flatMap((value) => {
            return [
              [
                `${tname} -> ${value.target_document}`,
                {
                  column_mapping: value.field_mapping,
                  foreign_table: [value.target_document],
                },
              ],
            ];
          });
        }

        let foreignKeys: Record<string, Constraint> = {};

        foreign_keys.forEach((value) => (foreignKeys[value[0]] = value[1]));

        let table: TableInfo = {
          name: tname,
          columns: columns,
          primary_key: ["id"],
          foreign_keys: foreignKeys,
        };
        tables.push(table);
      }
    }
  }

  return {
    tables: tables,
  };
}
