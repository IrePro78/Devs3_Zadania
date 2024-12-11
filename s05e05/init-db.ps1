Write-Host "Inicjalizacja bazy danych..."

# Sprawdź czy kontener działa
$container = docker ps --filter "name=supabase-db" --format "{{.Names}}"
if (-not $container) {
    Write-Host "X Kontener Postgres nie jest uruchomiony!"
    exit 1
}

Write-Host "Znaleziono kontener: $container"

# Wykonaj skrypt SQL bezpośrednio w kontenerze
Get-Content "./supabase/init.sql" | docker exec -i $container psql -U postgres -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "Baza danych została zainicjalizowana"
} else {
    Write-Host "Blad podczas inicjalizacji bazy danych"
    exit 1
} 