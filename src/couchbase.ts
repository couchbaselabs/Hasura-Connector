import fp from  "fastify-plugin";
import { Cluster } from "couchbase";

 async function fastifyCouchbase(fastify: any, options: any, done: any) {
   
    options = Object.assign({
        serverSelectionTimeoutMS: 7500
    }, options)
    const { forceClose, name, bucketName, url, client, ...opts } = options
    if (!url) {
        throw Error('`url` parameter is mandatory if no client is provided')
    }

    try {
    console.log(opts);

    const cluster = await Cluster.connect(url, options);
    const cb = {
        cluster
      };
  console.log(cb);
      fastify
        .decorate('cb', cb)
        .addHook('onClose', close);
        done();
    }
    catch (err) {
        console.log("YEEES",err);
        return done(err);
    }
}

function close(fastify: any, done:any) {
  fastify.cb.bucket.disconnect(done);
}

export default  fp(fastifyCouchbase, '>=0.25.3');