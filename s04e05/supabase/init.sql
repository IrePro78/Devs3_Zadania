-- Włącz rozszerzenie vector
create extension if not exists vector;

-- Tabela na dokumenty źródłowe (np. notatnik-rafala.md)
create table if not exists source_documents (
  id bigserial primary key,
  title text not null,                      -- tytuł dokumentu (np. "Notatnik Rafała")
  file_path text not null,                  -- ścieżka do pliku
  total_chunks int not null,                -- liczba fragmentów
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela na fragmenty tekstu z wektorami
create table if not exists documents (
  id bigserial primary key,
  content text not null,                    -- treść fragmentu
  embedding vector(3072),                   -- wektor dla text-embedding-3-large
  metadata jsonb not null default '{}'::jsonb,  -- metadane (source, type, chunkIndex, totalChunks, tags, etc.)
  source_document_id bigint references source_documents(id),  -- referencja do dokumentu źródłowego
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela na obrazy
create table if not exists document_images (
  id bigserial primary key,
  file_path text not null,                  -- ścieżka do pliku obrazu
  image_text text,                          -- tekst wyekstrahowany z obrazu
  source_document_id bigint references source_documents(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Funkcja do wyszukiwania podobnych dokumentów
create or replace function match_documents (
  query_embedding vector(3072),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  source_document_id bigint
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity,
    documents.source_document_id
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Indeksy
create index if not exists documents_embedding_idx 
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists documents_metadata_idx 
  on documents
  using gin (metadata);

create index if not exists documents_source_idx 
  on documents(source_document_id);

-- Uprawnienia
grant all privileges on all tables in schema public to postgres;
grant all privileges on all sequences in schema public to postgres;
grant execute on all functions in schema public to postgres;

-- Wyczyść istniejące dane (opcjonalnie)
truncate table document_images cascade;
truncate table documents cascade;
truncate table source_documents cascade;