import { SchemaResponse, TableInfo } from "@hasura/dc-api-types";
import { connect, model, start, Schema, Ottoman, Cluster } from "ottoman";
import { Config } from "./config";

const DocumentInfoSchema = new Schema({
  fields: [String],
  name: String,
  description: String,
  keys: [String]
});


const formatTableInfo = (config: Config) => (info: any): TableInfo => {
 
  const tableName = config.explicit_main_schema ? ["main", info.name] : [info.name];
  return {
    name: tableName,
    primary_key: info.keys,
    description: info.description,
    columns: info.columns
  }
}


export async function getSchema(config: Config, cluster: Cluster ): Promise<SchemaResponse> {
  const db = cluster.bucket(config.db);
  const collection = db.collection("metadata");
  
 
    /*const db                                        = connect(config, sqlLogger);
    const [results, metadata]                       = await db.query("SELECT * from sqlite_schema");
    const resultsT: Array<TableInfoInternal>        = results as Array<TableInfoInternal>;
    const filtered: Array<TableInfoInternal>        = resultsT.filter(table => includeTable(config,table));
    */
    //const result: Array<TableInfo> = results.map(formatTableInfo(config));
  
    return {
      tables: []
    };
  };
  