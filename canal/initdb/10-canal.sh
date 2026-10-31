#!/usr/bin/env bash
# Solo se ejecuta la primera vez que arranca Postgres (volumen vacío).
# La base principal (POSTGRES_DB=n8n) es la interna de n8n; aquí se crea "canal" para las métricas.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE canal"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d canal -f /schema/schema.sql
