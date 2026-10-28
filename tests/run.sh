#!/usr/bin/env bash
# Rigioca il martedì della demo contro lo schema e verifica chi vede cosa.
# Serve un Postgres locale raggiungibile come superuser (default: utente postgres via socket).
# Uso: tests/run.sh            (crea e distrugge il database pedibus_test)
#      PGHOST=... PGUSER=... tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=${PEDIBUS_TEST_DB:-pedibus_test}
PSQL="psql -v ON_ERROR_STOP=1 -q"

run() { $PSQL -d "$DB" "$@"; }

echo "▸ database $DB"
$PSQL -d postgres -c "drop database if exists $DB" >/dev/null
$PSQL -d postgres -c "create database $DB" >/dev/null

echo "▸ shim auth (solo in locale)"
run -f tests/shim_auth.sql

for f in supabase/migrations/*.sql; do
  echo "▸ migrazione $(basename "$f")"
  run -f "$f"
done

echo "▸ seed"
run -f supabase/seed.sql

echo "▸ replay del martedì + verifiche RLS"
run -o /dev/null -f tests/replay.sql

echo "▸ cancellazione automatica"
run -o /dev/null -f tests/pulizia.sql

echo "✔ tutto verde"
