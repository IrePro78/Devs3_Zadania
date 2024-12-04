#!/bin/bash

# Sprawdź czy Docker działa
docker ps > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Docker nie jest uruchomiony!"
    exit 1
fi

# Stałe parametry połączenia dla lokalnego Supabase
DB_HOST=localhost
DB_PORT=54322
DB_USER=postgres
DB_NAME=postgres

echo "Wykonuję skrypt SQL..."
PGPASSWORD=postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ./supabase/init.sql

if [ $? -eq 0 ]; then
    echo "Inicjalizacja bazy danych zakończona pomyślnie"
else
    echo "Błąd podczas inicjalizacji bazy danych"
    exit 1
fi 