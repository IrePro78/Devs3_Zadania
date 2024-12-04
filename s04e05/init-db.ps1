$content = Get-Content "./supabase/init.sql" -Raw
$content | docker exec -i supabase_db_supabase psql -U postgres -d postgres 