FROM postgres:15-bullseye

# Install locales and pgvector extension
RUN apt-get update && \
    apt-get install -y locales postgresql-15-pgvector && \
    echo "en_GB.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen en_GB.UTF-8 && \
    update-locale LANG=en_GB.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

# Set locale and timezone to match production
ENV LANG=en_GB.UTF-8
ENV LANGUAGE=en_GB:en
ENV LC_ALL=en_GB.UTF-8
ENV TZ=Europe/London

# Verify pgvector installation
RUN echo "Verifying pgvector installation..." && \
    ls -la /usr/share/postgresql/15/extension/vector* && \
    ls -la /usr/lib/postgresql/15/lib/vector* && \
    echo "pgvector files found successfully"

# Create init script to verify extension can be loaded
RUN mkdir -p /docker-entrypoint-initdb.d
RUN echo "#!/bin/bash" > /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "set -e" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "echo 'Testing pgvector extension...'" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "psql -v ON_ERROR_STOP=1 --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" <<-EOSQL" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "    CREATE EXTENSION IF NOT EXISTS vector;" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "    \\\\echo 'pgvector extension loaded successfully'" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    echo "EOSQL" >> /docker-entrypoint-initdb.d/01-verify-pgvector.sh && \
    chmod +x /docker-entrypoint-initdb.d/01-verify-pgvector.sh

# Expose standard PostgreSQL port
EXPOSE 5432
