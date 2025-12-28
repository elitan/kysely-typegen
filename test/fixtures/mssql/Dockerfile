FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
COPY init.sql /init.sql

RUN chmod 755 /entrypoint.sh /init.sql && chown mssql:root /entrypoint.sh /init.sql

USER mssql

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
