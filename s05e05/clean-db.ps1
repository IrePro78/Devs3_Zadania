Write-Host "Czyszczenie bazy danych..."

# Sprawdź czy kontener działa
$container = docker ps --filter "name=supabase-db" --format "{{.Names}}"
if (-not $container) {
    Write-Host "X Kontener Postgres nie jest uruchomiony!"
    exit 1
}

Write-Host "Znaleziono kontener: $container"

# SQL do wyczyszczenia danych
$cleanSQL = @"
TRUNCATE TABLE document_images CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE source_documents CASCADE;
"@

# Wykonaj czyszczenie
$cleanSQL | docker exec -i $container psql -U postgres -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "Baza danych została wyczyszczona"
} else {
    Write-Host "Blad podczas czyszczenia bazy danych"
    exit 1
} 