import { BinaryArrayComparisonOperator, BinaryComparisonOperator, ComparisonColumn, ComparisonValue, ErrorResponse, Expression, Aggregate, Field, OrderBy, OrderDirection, QueryRequest, QueryResponse, TableName, TableRelationships, UnaryComparisonOperator, ExplainResponse, RawRequest, RawResponse } from "@hasura/dc-api-types";
import { Cluster, IndexFailureError } from "couchbase";
import { Config } from "./config";
import { coerceUndefinedOrNullToEmptyRecord, coerceUndefinedToNull, envToBool, envToNum, isEmptyObject, omap, unreachable } from "./utils";
/** Helper type for convenience. Uses the sqlstring-sqlite library, but should ideally use the function in sequalize.
 */
type Fields = Record<string, Field>

function valueTemplate(value: any): string {
  return `'${value}'`;
}

/**
 *
 * @param identifier: Unescaped name. E.g. 'Alb"um'
 * @returns Escaped name. E.g. '"Alb\"um"'
 */
function escapeIdentifier(identifier: string): string {
  // TODO: Review this function since the current implementation is off the cuff.
  const result = identifier.replace(/\\/g, "\\\\").replace(/`/g, '\\`');
  return `\`${result}\``;
}

/**
 * Throw an exception if the tableName has invalid number of prefix components.
 *
 * @param tableName: Unescaped table name. E.g. 'Alb"um'
 * @returns tableName
 */
function validateTableName(tableName: TableName): TableName {
  if (tableName.length <= 2 && tableName.length > 0)
    return tableName;
  else
    throw new Error(`${tableName.join(".")} is not a valid table`);
}

/**
 * Generate projection to select clasule of N1QL 
 * @param fields 
 * @returns 
 */
function select_fields(fields: Fields): string {
  const result = omap(fields, (fieldName, field) => {
    switch (field.type) {
      case "column":
        const { column } = field;
        return `${ column == 'id' ? "meta().id" : column } AS ${fieldName}`;
      case "relationship":
        throw new Error(`Relationship field are no support`);
      default:
        return unreachable(field["type"]);
    }
  }).join(", ");

  return tag('select_fields', `${result}`);
}

/**
 * Convert all expression to conditions of WHERE clasule of N1QL
 * @param expression 
 * @param queryTableAlias 
 * @returns 
 */
function where_clause(expression: Expression, queryTableAlias: string, logger: any): string {
  const generateWhere = (expression: Expression, currentTableAlias: string): string => {
    switch (expression.type) {
      case "not":
        const aNot = generateWhere(expression.expression, currentTableAlias);
        return `(NOT ${aNot})`;

      case "and":
        const aAnd = expression.expressions.flatMap(x => generateWhere(x, currentTableAlias));
        return aAnd.length > 0
          ? `(${aAnd.join(" AND ")})`
          : "(1 = 1)"; // true

      case "or":
        const aOr = expression.expressions.flatMap(x => generateWhere(x, currentTableAlias));
        return aOr.length > 0
          ? `(${aOr.join(" OR ")})`
          : "(1 = 0)"; // false

      case "exists":
        throw new Error(`Exists expression are not supported.`);

      case "unary_op":
        const uop = uop_op(expression.operator);
        const columnFragment = generateComparisonColumnFragment(expression.column, queryTableAlias, currentTableAlias);
        return `(${columnFragment} ${uop})`;

      case "binary_op":
        const bopLhs = generateComparisonColumnFragment(expression.column, queryTableAlias, currentTableAlias);
        const bop = bop_op(expression.operator);
        const bopRhs = generateComparisonValueFragment(expression.value, queryTableAlias, currentTableAlias, logger);
        return `${bopLhs} ${bop} ${bopRhs}`;

      case "binary_arr_op":
        const bopALhs = generateComparisonColumnFragment(expression.column, queryTableAlias, currentTableAlias);
        const bopA = bop_array(expression.operator);
        logger.info(`TYPE: ${expression.values}`);
        const bopARhsValues = expression.values.map(v => expression.value_type == "string" ? valueTemplate(v) : v).join(", ");
        return `(${bopALhs} ${bopA} (${bopARhsValues}))`;

      default:
        return unreachable(expression['type']);
    }
  };

  return generateWhere(expression, queryTableAlias);
}


function generateComparisonColumnFragment(comparisonColumn: ComparisonColumn, queryTableAlias: string, currentTableAlias: string): string {
  const path = comparisonColumn.path ?? [];
  if (path.length === 0) {
    return `${currentTableAlias}.${escapeIdentifier(comparisonColumn.name)}`
  } else if (path.length === 1 && path[0] === "$") {
    return `${queryTableAlias}.${escapeIdentifier(comparisonColumn.name)}`
  } else {
    throw new Error(`Unsupported path on ComparisonColumn: ${[...path, comparisonColumn.name].join(".")}`);
  }
}

function generateComparisonValueFragment(comparisonValue: ComparisonValue, queryTableAlias: string, currentTableAlias: string, logger: any): string {
  switch (comparisonValue.type) {
    case "column":
      return generateComparisonColumnFragment(comparisonValue.column, queryTableAlias, currentTableAlias);
    case "scalar":
      if (["string", "date"].includes(comparisonValue.value_type.toLowerCase())) return valueTemplate(comparisonValue.value);
      return comparisonValue.value;
    default:
      return unreachable(comparisonValue["type"]);
  }
}

/**
  * Convert all part from query request expression and config to N1QL query
  * @param config contain bucket, scope and collection
  * @param tableName represent type of document in collection
  * @param fields fields expression that will be projected in SELECT clasule of N1QL
  * @param wWhere where expression that will be apply in WHERE clasule of N1QL
  * @param wLimit limit expression that will be apply in LIMIT clasule of N1QL
  * @param wOffset offset expression that will be apply in OFFSET clasule of N1QL
  * @param wOrder orderBy expression that will be apply in ORDER BY clasule of N1QL
  * @param logger instance of fastfy server logger
  * @returns the N1QL query
  */
function n1ql_query(
  config: Config,
  tableName: TableName,
  fields: Fields,
  wWhere: Expression | null,
  wLimit: number | null,
  wOffset: number | null,
  wOrder: OrderBy | null,
  logger: any,
): string {
  const tableAlias = validateTableName(tableName).map((str: any) => str.toLowerCase()).join("_");
  const from = `\`${config.bucket}\`.\`${config.scope}\`.\`${config.collection}\``;
  const n1qlQuery = isEmptyObject(fields) ? '' : (() => {
    const innerFromClauses = `${where(wWhere, tableAlias, logger)} ${order(wOrder, tableAlias)} ${limit(wLimit)} ${offset(wOffset)}`;
    return `SELECT ${select_fields(fields)} FROM ${from} AS ${tableAlias} ${innerFromClauses}`;
  })()
  logger.info(`Converter expression to query ${n1qlQuery}`);
  return tag('n1ql_query', `${n1qlQuery}`);
}

function bop_array(o: BinaryArrayComparisonOperator): string {
  switch (o) {
    case 'in': return tag('bop_array', 'IN');
    default: return tag('bop_array', o);
  }
}

function bop_op(o: BinaryComparisonOperator): string {
  let result = o;
  switch (o) {
    case 'equal': result = "="; break;
    case 'greater_than': result = ">"; break;
    case 'greater_than_or_equal': result = ">="; break;
    case 'less_than': result = "<"; break;
    case 'less_than_or_equal': result = "<="; break;
  }
  return tag('bop_op', result);
}

function uop_op(o: UnaryComparisonOperator): string {
  let result = o;
  switch (o) {
    case 'is_null': result = "IS NULL"; break;
  }
  return tag('uop_op', result);
}
/**
 * Parse direction in OrderBy expression
 * @param orderDirection 
 * @returns 
 */
function orderDirection(orderDirection: OrderDirection): string {
  switch (orderDirection) {
    case "asc":
    case "desc":
      return orderDirection.toUpperCase();
    default:
      return unreachable(orderDirection);
  }
}

/**
 * Convert OrderBy expression to N1QL clause
 * @param orderBy
 * @param queryTableAlias
 * @returns string
 */
function order(orderBy: OrderBy | null, queryTableAlias: string): string {
  if (orderBy === null || orderBy.elements.length < 1) {
    return "";
  }

  const result =
    orderBy.elements
      .map((orderByElement: any) => {
        if (orderByElement.target_path.length > 0 || orderByElement.target.type !== "column") {
          throw new Error("Unsupported OrderByElement. Relations and aggregates and not supported.");
        }
        return `${queryTableAlias}.${escapeIdentifier(orderByElement.target.column)} ${orderDirection(orderByElement.order_direction)}`;
      }).join(', ');

  return tag('order', `ORDER BY ${result}`);
}

/**
 * @param whereExpression Nested expression used in the associated where clause
 * @param queryTableAlias represent type of the document
 * @returns string representing the combined where clause
 */
function where(whereExpression: Expression | null, queryTableAlias: string, logger: any): string {
  const whereClause = whereExpression !== null ? [`type = "${queryTableAlias}"`, where_clause(whereExpression, queryTableAlias, logger)] : [`type = "${queryTableAlias}"`];
  logger.info(whereClause);
  return whereClause.length < 1
    ? ""
    : tag('where', `WHERE ${whereClause.join(" AND ")}`);
}
/**
 * Convert Limit expression to N1QL clause
 * @param l 
 * @returns string
 */
function limit(l: number | null): string {
  if (l === null) {
    return "";
  } else {
    return tag('limit', `LIMIT ${l}`);
  }
}

function offset(o: number | null): string {
  if (o === null) {
    return "";
  } else {
    return tag('offset', `OFFSET ${o}`);
  }
}

function cast_aggregate_function(f: string): string {
  switch (f) {
    case 'avg':
    case 'max':
    case 'min':
    case 'sum':
    case 'total':
      return f;
    default:
      throw new Error(`Aggregate function ${f} is not supported by N1QL`);
  }
}
type Aggregates = Record<string, Aggregate>
/**
* Builds an Aggregate query expression.
*/
function aggregates_query(
  logger: any,
  config: Config,
  tableName: TableName,
  aggregates: Aggregates,
  wWhere: Expression | null,
  wLimit: number | null,
  wOffset: number | null,
  wOrder: OrderBy | null,
): string {
  if (isEmptyObject(aggregates))
    return "";

  const tableAlias = validateTableName(tableName).map((str: any) => str.toLowerCase()).join("_");
  const from = `\`${config.bucket}\`.\`${config.scope}\`.\`${config.collection}\``;

  const whereClause = where(wWhere, tableAlias, logger);

  const aggregate_pairs = Object.entries(aggregates).map(([k, v]) => {
    switch (v.type) {
      case 'star_count':
        return ` COUNT(*) AS ${k}`;
      case 'column_count':
        if (v.distinct) {
          return `COUNT(DISTINCT ${escapeIdentifier(v.column)}) AS ${k}`;
        } else {
          return `COUNT(${escapeIdentifier(v.column)}) AS ${k}`;
        }
      case 'single_column':
        return `${cast_aggregate_function(v.function)}(${escapeIdentifier(v.column)}) AS ${k}`;
    }
  }).join(', ');
  const sourceSubquery = `SELECT ${aggregate_pairs} FROM  ${from}  AS ${tableAlias} ${whereClause} ${limit(wLimit)} ${offset(wOffset)}`


  return sourceSubquery;
}
/** Top-Level Query Function. It parse the query request and hasura header config to generate the N1QL
 *  @param request Hasura query request that include query, table and relations
 *  @param config With bucket, scope and collection
 *  @param logger Fastify logger to inclue some informations in server log.
 *  @return string
 */
function query(request: QueryRequest, config: Config, logger: any): string {
  logger.info(request.query);
  const result = n1ql_query(
    config,
    request.table,
    coerceUndefinedOrNullToEmptyRecord(request.query.fields),
    coerceUndefinedToNull(request.query.where),
    coerceUndefinedToNull(request.query.limit),
    coerceUndefinedToNull(request.query.offset),
    coerceUndefinedToNull(request.query.order_by),
    logger
  );
  logger.info(result);

  return tag('query', `${result}`);
}


function agregateQuery(request: QueryRequest, config: Config, logger: any): string {
  const aggregate = aggregates_query(logger, config, request.table, coerceUndefinedOrNullToEmptyRecord(request.query.aggregates), coerceUndefinedToNull(request.query.where), coerceUndefinedToNull(request.query.limit),
    coerceUndefinedToNull(request.query.offset),
    coerceUndefinedToNull(request.query.order_by));
  logger.info(aggregate);
  return tag('agregate_query', `${aggregate}`);
}

/** Format the DB response into a /query response.
 *
 * Note: There should always be one result since 0 rows still generates an empty JSON array.
 * @param result from couchbase query and parse to generate null columns
 * @param defaultObject object with struct that need project
 * @return any
 */
function output(result: { rows: Array<any> }, defaultObject: any, agregate: { rows: Array<any> } | null): any {
  const rows: any[] = [];

  result.rows.forEach(element => {
    rows.push({ ...defaultObject, ...element });
  });
  return { rows: rows, aggregates: agregate?.rows[0] };
}

const DEBUGGING_TAGS = envToBool('DEBUGGING_TAGS');
/** Function to add SQL comments to the generated SQL to tag which procedures generated what text.
 *
 * tag('a','b') => '/*\<a>\*\/ b /*\</a>*\/'
 * @param t
 * @param s
 * @return string
 */
function tag(t: string, s: string): string {
  if (DEBUGGING_TAGS) {
    return `/*<${t}>*/ ${s} /*</${t}>*/`;
  } else {
    return s;
  }
}

/** Initialize all the properties requested in the query, to all documents that may be missing any fields.
 * @param request 
 * @returns any
 */

function defaultObject(request: QueryRequest) {
  const _fields = coerceUndefinedOrNullToEmptyRecord(request.query.fields);
  let obj: Record<string, any> = {};
  omap(_fields, (fieldName, field) => {
    obj[fieldName] = null;
  });
  return obj;
}

/** Performs a query and returns results
 *
 * Limitations:
 *
 * - Nested documents
 * - Related documents.
 *
 * The current algorithm is to first create a simple query from a document type in a collection of scope, then execute it, returning results.
 * 
 * @param cluster instance to cluster connection
 * @param queryRequest hasura query request expression 
 * @param config config parse from hasura header request
 * @param logger instance of fastify logger
 *
 */
export async function queryData(cluster: Cluster, queryRequest: QueryRequest, config: Config, logger: any): Promise<QueryResponse | ErrorResponse> {
  logger.info(queryRequest);
  const q = query(queryRequest, config, logger);
  const q_aggregate = agregateQuery(queryRequest, config, logger);

  const query_length_limit = envToNum('QUERY_LENGTH_LIMIT', Infinity);
  if (q.length > query_length_limit) {
    logger.error(`Generated N1QL Query was too long (${q.length} > ${query_length_limit})`);
    const result: ErrorResponse =
    {
      message: `Generated N1QL Query was too long (${q.length} > ${query_length_limit})`,
      details: {
        "query.length": q.length,
        "limit": query_length_limit
      }
    };
    return result;
  } else {
    try {
      const bucket = cluster.bucket(config.bucket);
      const result = await bucket.scope(config.scope ?? 'default').query(q);
      const agregate_result = q_aggregate.length > 0 ? await bucket.scope(config.scope ?? 'default').query(q_aggregate) : null;
      return output(result, defaultObject(queryRequest), agregate_result);
    }
    catch (ex) {
      if (ex instanceof IndexFailureError) {
        return {
          message: ex.message,
          details: ex
        };
      }

      return {
        message: 'Unknow error',
        type: 'uncaught-error',
        details: ex
      };
    }
  }
}

/**
 *
 * Constructs a query as per the `POST /query` endpoint but prefixes it with `EXPLAIN` before execution.
 *
 * Formatted result lines are included under the `lines` field. An initial blank line is included to work around a display bug.
 *
 * NOTE: The Explain related items are included here since they are a small extension of Queries, and another module may be overkill.
 *
 * @param cluster
 * @param config
 * @param logger
 * @param queryRequest
 * @returns
 */
export async function explain(cluster: Cluster, config: Config, logger: any, queryRequest: QueryRequest): Promise<ExplainResponse | ErrorResponse> {
  try {
    const q = query(queryRequest, config, logger);
    const { rows } = await cluster.query(`EXPLAIN ${q}`);

    logger.info(`EXPLAINS ${rows}`);

    return {
      query: q,
      lines: ["", JSON.stringify(rows, undefined, 4)]
    }
  }
  catch (ex) {
    if (ex instanceof IndexFailureError) {
      return {
        message: ex.message,
        details: ex
      };
    }

    return {
      message: 'Unknow error',
      type: 'uncaught-error',
      details: ex
    };
  }
}


export async function runRawOperation(cluster: Cluster, config: Config, logger: any, query: RawRequest): Promise<RawResponse | ErrorResponse> {

  try {
    const { rows } = await cluster.query(query.query);

    return {
      rows
    };
  }
  catch (ex) {
    if (ex instanceof IndexFailureError) {
      return {
        message: ex.message,
        details: ex
      };
    }

    return {
      message: 'Unknow error',
      type: 'uncaught-error',
      details: ex
    };
  }
};