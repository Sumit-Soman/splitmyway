# PocketBase API — migrations baked in; pb_data is a persistent volume at runtime.
# Version kept in sync with docker-compose.yml / scripts/ensure-pocketbase.sh (0.25.8).
ARG PB_VERSION=0.25.8
FROM alpine:3.20

RUN apk add --no-cache ca-certificates unzip wget

RUN wget -qO /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && unzip -q /tmp/pb.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/pocketbase \
  && rm /tmp/pb.zip

WORKDIR /pb
COPY pb_migrations /pb/pb_migrations
VOLUME /pb/pb_data
EXPOSE 8090
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
