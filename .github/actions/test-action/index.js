const core = require("@actions/core");
const github = require("@actions/github");
const { isDeepStrictEqual } = require("util");

try {
  const graphql = core.getInput("graphql-input");
  const n1q1 = core.getInput("n1q1-input");
  const hasuraBody = {
    query: graphql,
  };
  const hasuraResult = fetch("http://localhost:8080/v1/graphql", {
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(hasuraBody),
    method: "POST",
  });
  console.log(hasuraResult);
  const couchbaseBody = {
    statement: n1q1,
  };
  const couchbaseResult = await fetch(
    "http://localhost:8091/query/service",
    {
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(couchbaseBody),
      method: "POST",
    }
  );
  console.log(couchbaseResult);
  const result = isDeepStrictEqual(couchbaseResult, hasuraResult);
  core.setOutput("result", result);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2);
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
