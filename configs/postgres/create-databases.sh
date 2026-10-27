#!/usr/bin/env sh

set -o errexit
set -o nounset

env | sed -n 's/^[A-Z0-9_]*_POSTGRES_DB=\(.*\)$/\1/p' | sort -u | while read -r database; do
  if [ -z "${database}" ]; then
    continue
  fi

  exists="$(
    echo "SELECT 1 FROM pg_database WHERE datname = :'database'" |
      psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --set ON_ERROR_STOP=1 \
        --set database="${database}" --tuples-only --no-align
  )"

  if [ "${exists}" = "1" ]; then
    echo "Database ${database} already exists"
  else
    echo 'CREATE DATABASE :"database"' |
      psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --set ON_ERROR_STOP=1 \
        --set database="${database}"
  fi
done
