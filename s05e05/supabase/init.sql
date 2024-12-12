-- Włącz rozszerzenie vector
create extension if not exists vector;

-- Tabela na dokumenty źródłowe
create table if not exists source_documents (
  id bigserial primary key,
  title text not null,                      -- nazwa pliku
  file_path text not null,                  -- ścieżka do pliku
  document_type text not null,              -- typ dokumentu: 'phone', 'web', 'document'
  original_content text not null,           -- oryginalna treść przed podziałem
  total_chunks int not null,                -- liczba fragmentów
  metadata jsonb not null default '{}'::jsonb,  -- dodatkowe metadane specyficzne dla typu
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  media_type text,
  duration integer,
  dimensions text
);

-- Tabela na fragmenty tekstu z wektorami
create table if not exists documents (
  id bigserial primary key,
  content text not null,                    -- treść fragmentu
  embedding vector(3072),                   -- wektor dla text-embedding-3-large
  metadata jsonb not null default '{}'::jsonb,  -- metadane (chunk_index, conversation_id dla phone, etc.)
  source_document_id bigint references source_documents(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

create index if not exists source_documents_type_idx
  on source_documents(document_type);

create index if not exists source_documents_metadata_idx
  on source_documents
  using gin (metadata);

-- Dodaj nowe indeksy dla powiązań między fragmentami
create index if not exists documents_topic_idx 
  on documents((metadata->>'topic'));

create index if not exists documents_section_id_idx 
  on documents((metadata->>'section_id'));

create index if not exists documents_prev_fragment_idx 
  on documents((metadata->>'prev_fragment_id'));

create index if not exists documents_next_fragment_idx 
  on documents((metadata->>'next_fragment_id'));

-- Dodaj indeksy dla powiązań między fragmentami
create index if not exists documents_original_text_idx 
  on documents((metadata->>'original_text_id'));

create index if not exists documents_part_index_idx 
  on documents((metadata->>'part_index'));

create index if not exists documents_prev_part_idx 
  on documents((metadata->>'prev_part_id'));

create index if not exists documents_next_part_idx 
  on documents((metadata->>'next_part_id'));

-- Dodaj indeksy dla wyszukiwania multimediów
create index if not exists source_documents_media_type_idx 
  on source_documents(media_type);

create index if not exists documents_media_type_idx 
  on documents((metadata->>'media_type'));

create index if not exists documents_transcript_idx 
  on documents
  using gin (to_tsvector('polish', content));

-- Funkcja wyszukiwania
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
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity,
    d.source_document_id
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Funkcja do pobierania powiązanych fragmentów
create or replace function get_related_fragments(
  document_id bigint
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  part_index int,
  total_parts int
)
language plpgsql
as $$
begin
  return query
  with base_doc as (
    select d.metadata->>'original_text_id' as original_text_id
    from documents d
    where d.id = document_id
  )
  select 
    d.id,
    d.content,
    d.metadata,
    (d.metadata->>'part_index')::int as part_index,
    (d.metadata->>'total_parts')::int as total_parts
  from documents d, base_doc
  where d.metadata->>'original_text_id' = base_doc.original_text_id
  order by (d.metadata->>'part_index')::int;
end;
$$;

-- Funkcja do wyszukiwania po transkrypcji
create or replace function search_transcripts(
  search_query text,
  media_type text default null
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  source_document_id bigint,
  rank float4
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    d.source_document_id,
    ts_rank(to_tsvector('polish', d.content), plainto_tsquery('polish', search_query)) as rank
  from documents d
  where 
    to_tsvector('polish', d.content) @@ plainto_tsquery('polish', search_query)
    and (media_type is null or d.metadata->>'media_type' = media_type)
  order by rank desc;
end;
$$;

-- Uprawnienia
grant all privileges on all tables in schema public to postgres;
grant all privileges on all sequences in schema public to postgres;
grant execute on all functions in schema public to postgres;

-- Wyczyść istniejące dane
truncate table documents cascade;
truncate table source_documents cascade;