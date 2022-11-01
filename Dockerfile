FROM node:19-alpine
RUN apk add g++ make py3-pip\
    && rm -rf /var/cache/apk/*
WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY tsconfig.json .
COPY src src

# This is just to ensure everything compiles ahead of time.
# We'll actually run using ts-node to ensure we get TypesScript
# stack traces if something fails at runtime.
RUN npm run typecheck

EXPOSE 8100

# We don't bother doing typechecking when we run (only TS->JS transpiling)
# because we checked it above already. This uses less memory at runtime.
CMD [ "npm", "run", "--silent", "start-no-typecheck" ]
