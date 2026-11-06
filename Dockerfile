FROM node:24-bookworm-slim AS build
WORKDIR /source
COPY . .
RUN node scripts/build-release.mjs

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 ADMIN_DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /source/.build/site/ ./
RUN mkdir -p /data && chown node:node /data
USER node
STOPSIGNAL SIGTERM
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "require('node:http').get({host:'127.0.0.1',port:4173,path:'/healthz',headers:{Host:new URL(process.env.PUBLIC_ORIGIN).host}},r=>{r.resume();if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"
CMD ["node", "server.mjs"]
