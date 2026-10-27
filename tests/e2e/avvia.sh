#!/usr/bin/env bash
# Avvia il Supabase in miniatura per i test end-to-end dell'app:
#   database pedibus_e2e (migrazioni + seed, senza replay) · PostgREST :3011 · supalite :54329
# Serve: Postgres locale come superuser, il binario postgrest (PGRST_BIN), node.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=pedibus_e2e
PGRST_BIN=${PGRST_BIN:-postgrest}
SECRET=${JWT_SECRET:-pedibus-e2e-jwt-secret-abcdefghijklmnopqrstuvwxyz0123456789}
PSQL="psql -v ON_ERROR_STOP=1 -q"

# Prima si fermano i servizi, altrimenti il database non si può ricreare.
pkill -f "[p]ostgrest /tmp/pedibus-postgrest.conf" 2>/dev/null || true
pkill -f "[s]upalite.js" 2>/dev/null || true
sleep 1
echo "▸ database $DB"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f tests/shim_auth.sql
for f in supabase/migrations/*.sql; do $PSQL -d $DB -f "$f" >/dev/null 2>&1 || $PSQL -d $DB -f "$f"; done
$PSQL -d $DB -f supabase/seed.sql
$PSQL -d $DB <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'authenticator';
  end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
-- Le revoche delle migrazioni vanno riapplicate dopo il grant generale (le funzioni interne restano chiuse).
revoke execute on function chiudi_assenze(date, timestamptz), soglia_definitiva(date, timestamptz), controllo_volontari(date, timestamptz), allarga_escalation(timestamptz), esegui_job(timestamptz), avvisi_webhook(), avvisi_ritenta() from anon, authenticated;
alter role authenticator set pgrst.db_schemas = 'public';
SQL

cat > /tmp/pedibus-postgrest.conf <<CONF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3011
server-host = "127.0.0.1"
CONF

echo "▸ postgrest :3011"
$PGRST_BIN /tmp/pedibus-postgrest.conf > /tmp/pedibus-postgrest.log 2>&1 &
echo "▸ supalite :54329"
JWT_SECRET=$SECRET node tests/e2e/supalite.js > /tmp/pedibus-supalite.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "postgrest %{http_code}\n" http://127.0.0.1:3011/
echo "pronto. Chiave anon: $(node -e "const {sign}=require('./tests/e2e/supalite.js');console.log(sign({role:'anon',iss:'supalite',exp:Math.floor(Date.now()/1000)+86400*365}))" 2>/dev/null | tail -1)"
