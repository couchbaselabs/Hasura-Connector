import Fastify from 'fastify';
import FastifyCors from '@fastify/cors';
import { getConfig, tryGetConfig } from './config';
import { capabilitiesResponse } from './capabilities';
import { envToBool, envToNum, envToString } from './utils';
import * as fs from 'fs'
import { QueryResponse, SchemaResponse, QueryRequest, CapabilitiesResponse, ErrorResponse, ExplainResponse, RawRequest, RawResponse } from '@hasura/dc-api-types';
import { getSchema } from './schema';
import { Cluster } from 'couchbase';
import { explain, queryData, runRawOperation } from './query';
import dotenv from 'dotenv';
import metrics from 'fastify-metrics';
import prometheus from 'prom-client';


/*import { explain, queryData } from './query';
import { connect } from './db';
import metrics from 'fastify-metrics';
import prometheus from 'prom-client';
import * as fs from 'fs'
import { runRawOperation } from './raw';*/
dotenv.config();
const port = envToNum("PORT", 8100);

// NOTE: Pretty printing for logs is no longer supported out of the box.
// See: https://github.com/pinojs/pino-pretty#integration
// Pretty printed logs will be enabled if you have the `pino-pretty`
// dev dependency installed as per the package.json settings.
const server = Fastify({
  logger:
  {
    level: envToString("LOG_LEVEL", "info"),
    ...(
      (envToBool('PRETTY_PRINT_LOGS'))
        ? { transport: { target: 'pino-pretty' } }
        : {}
    )
  }
})

server.setErrorHandler(function (error, _request, reply) {
  // Log error
  this.log.error(error)

  const errorResponse: ErrorResponse = {
    type: "uncaught-error",
    message: "Couchbase Agent: Uncaught Exception",
    details: {
      name: error.name,
      message: error.message
    }
  };

  // Send error response
  reply.status(500).send(errorResponse);
})

const METRICS_ENABLED = envToBool('METRICS');

if(METRICS_ENABLED) {
  // See: https://www.npmjs.com/package/fastify-metrics
  server.register(metrics, {
    endpoint: '/metrics',
    routeMetrics: {
      enabled: true,
      registeredRoutesOnly: false,
    }
  });
}

if (envToBool('PERMISSIVE_CORS')) {
  // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
  server.register(FastifyCors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["X-Hasura-DataConnector-Config", "X-Hasura-DataConnector-SourceName"]
  });
}

// Register request-hook metrics.
// This is done in a closure so that the metrics are scoped here.
(() => {
  if(! METRICS_ENABLED) {
    return;
  }

  const requestCounter = new prometheus.Counter({
    name: 'http_request_count',
    help: 'Number of requests',
    labelNames: ['route'],
  });

  // Register a global request counting metric
  // See: https://www.fastify.io/docs/latest/Reference/Hooks/#onrequest
  server.addHook('onRequest', async (request, reply) => {
    requestCounter.inc({route: request.routerPath});
  })
})();

// Serves as an example of a custom histogram
// Not especially useful at present as this mirrors
// http_request_duration_seconds_bucket but is less general
// but the query endpoint will offer more statistics specific
// to the database interactions in future.
const queryHistogram = new prometheus.Histogram({
  name: 'query_durations',
  help: 'Histogram of the duration of query response times.',
  buckets: prometheus.exponentialBuckets(0.0001, 10, 8),
  labelNames: ['route'] as const,
});

/**
 * A plugin that provide encapsulated routes
 * @param {FastifyInstance} fastify encapsulated fastify instance
 * @param {Object} options plugin options, refer to https://www.fastify.io/docs/latest/Reference/Plugins/#plugin-options
 */
async function routes(fastify: any, options: any, done: any) {
  const cb = fastify.cb;

  // NOTE:
  //
  // While an ErrorResponse is available it is not currently used as there are no errors anticipated.
  // It is included here for illustrative purposes.
  //
  server.get<{ Reply: CapabilitiesResponse | ErrorResponse }>("/capabilities", async (request, _response) => {
    server.log.info({ headers: request.headers, query: request.body, }, "capabilities.request");
    return capabilitiesResponse;
  });

  server.get<{ Reply: SchemaResponse }>("/schema", async (request, _response) => {
    server.log.info({ headers: request.headers, query: request.body, }, "schema.request");
    const config = getConfig(request);
    return getSchema(config, cb.cluster, server.log);
  });


server.post<{ Body: QueryRequest, Reply: QueryResponse | ErrorResponse }>("/query", async (request, response) => {
    server.log.info({ headers: request.headers, query: request.body, }, "query.request");
    const end = queryHistogram.startTimer()
    const config = getConfig(request);
    server.log.info(request.body);
    const result: QueryResponse | ErrorResponse = await queryData(cb.cluster, request.body, config, server.log);
    end();
    if ("message" in result) {
        response.statusCode = 500;
    }
    return result;
});

server.post<{ Body: RawRequest, Reply: RawResponse }>("/raw", async (request, _response) => {
  server.log.info({ headers: request.headers, query: request.body, }, "schema.raw");
  const config = getConfig(request);
  server.log.info("RAW QUERY");
  server.log.info(request.body);
  return runRawOperation(cb.cluster, config, server.log, request.body);
});

server.post<{ Body: QueryRequest, Reply: ExplainResponse}>("/explain", async (request, _response) => {
  server.log.info({ headers: request.headers, query: request.body, }, "query.request");
  const config = getConfig(request);
  return explain(cb.cluster, config, server.log, request.body);
});

server.get("/health", async (request, response) => {
  const config = tryGetConfig(request);
  response.type('application/json');

  if (config === null) {
    server.log.info({ headers: request.headers, query: request.body, }, "health.request");
    response.statusCode = 204;
  } else {
    server.log.info({ headers: request.headers, query: request.body, }, "health.db.request");
    const n1ql_query  = `select 1 as r from \`${config.bucket}\`.\`${config.scope}\`.\`${config.collection}\` where 1 = 1 limit 1`;
    const result = await cb.cluster.query(n1ql_query);
   if (result.rows && JSON.stringify(result.rows) == '[{"r":1}]') {
    response.statusCode = 204;
    } else {
        response.statusCode = 500;
        return { "error": "problem executing query", "query_result": result };
    }
  }
});

server.get("/swagger.json", async (request, response) => {
  fs.readFile('src/types/agent.openapi.json', (err, fileBuffer) => {
    response.type('application/json');
    response.send(err || fileBuffer)
  })
})

server.get("/", async (request, response) => {
  response.type('text/html');
  return `<!DOCTYPE html>
    <html>
      <head>
        <title>Hasura Data Connectors Couchbase Agent</title>
      </head>
      <body>
        <h1>Hasura Data Connectors Couchbase Agent</h1>
        <p>See <a href="https://github.com/hasura/graphql-engine#hasura-graphql-engine">
          the GraphQL Engine repository</a> for more information.</p>
        <ul>
          <li><a href="/">GET / - This Page</a>
          <li><a href="/capabilities">GET /capabilities - Capabilities Metadata</a>
          <li><a href="/schema">GET /schema - Agent Schema</a>
          <li><a href="/query">POST /query - Query Handler</a>
          <li><a href="/raw">POST /raw - Raw Query Handler</a>
          <li><a href="/health">GET /health - Healthcheck</a>
          <li><a href="/swagger.json">GET /swagger.json - Swagger JSON</a>
          <li><a href="/metrics">GET /metrics - Prometheus formatted metrics</a>
        </ul>
      </body>
    </html>
  `;
});

done();
};

server.register(routes);

process.on('SIGINT', () => {
  server.log.info("interrupted");
  process.exit(0);
});


const start = async () => {
  
  try {
    const cb = envToString('CONNECTION_STRING', "couchbase://localhost");
    server.log.info(`Database ${cb}`);
    const cluster = await Cluster.connect(cb, {
      username: envToString('CB_USERNAME', "Administrator"),
      password: envToString('CB_PASSWORD', "password")
    });
    server.decorate("cb", {cluster});
    server.addHook("onClose", ( req, done) => {
      cluster.close().finally(done);
    });
    server.log.info(`STARTING on port ${port}`);
    await server.listen({ port: port, host: "0.0.0.0" });
  }
  catch (err) {
    server.log.fatal(err);
    process.exit(1);
  }
};


start();
