#!/bin/bash
# used to start couchbase server - can't get around this as docker compose only allows you to start one command - so we have to start couchbase like the standard couchbase Dockerfile would 
# https://github.com/couchbase/docker/blob/master/enterprise/couchbase-server/7.1.4/Dockerfile#L88

/entrypoint.sh couchbase-server & 

# track if setup is complete so we don't try to setup again
FILE=/opt/couchbase/init/setupComplete.txt

if ! [ -f "$FILE" ]; then
  # used to automatically create the cluster based on environment variables
  # https://docs.couchbase.com/server/current/cli/cbcli/couchbase-cli-cluster-init.html

  echo $COUCHBASE_ADMINISTRATOR_USERNAME ":"  $COUCHBASE_ADMINISTRATOR_PASSWORD  

  sleep 10s 
  /opt/couchbase/bin/couchbase-cli cluster-init -c 127.0.0.1 \
  --cluster-username $COUCHBASE_ADMINISTRATOR_USERNAME \
  --cluster-password $COUCHBASE_ADMINISTRATOR_PASSWORD \
  --services data,index,query \
  --cluster-ramsize $COUCHBASE_RAM_SIZE \
  --cluster-index-ramsize $COUCHBASE_INDEX_RAM_SIZE \
  --index-storage-setting default

  sleep 2s 

  # used to auto load in the sample data 
  # https://docs.couchbase.com/server/current/cli/cbcli/couchbase-cli-bucket-create.html
  /opt/couchbase/bin/curl -v http://localhost:8091/sampleBuckets/install \
  -u $COUCHBASE_ADMINISTRATOR_USERNAME:$COUCHBASE_ADMINISTRATOR_PASSWORD \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d '["travel-sample"]'
      
  sleep 2s

  # create indexes for the sample data
  # /opt/couchbase/bin/curl -v http://localhost:8093/query/service \
  # -u $COUCHBASE_ADMINISTRATOR_USERNAME:$COUCHBASE_ADMINISTRATOR_PASSWORD \
  # -d 'statement=CREATE INDEX idx_projects_type on projects(documentType)'
      
  # sleep 2s

  #add the meta data to hasura
  /opt/couchbase/bin/curl -v -d "@/opt/couchbase/init/metadata.json" http://hasura:8080/v1/metadata
  # create file so we know that the cluster is setup and don't run the setup again 
  touch $FILE
fi 
  # docker compose will stop the container from running unless we do this
  # known issue and workaround
  tail -f /dev/null
