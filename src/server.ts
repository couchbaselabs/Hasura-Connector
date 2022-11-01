import express, { Application } from "express";
import cors from "cors";

const app: Application = express();

app.use(express.json());
app.use(cors());
const port  = Number(process.env.PORT) || 5800;
app.use("/", async (request, response) => {
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
app.listen(port, () => console.log(`Listening on port ${port}`));
