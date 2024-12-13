-- Włącz rozszerzenie vector
create extension if not exists vector;
create extension if not exists unaccent;

-- Dodaj konfigurację wyszukiwania dla języka polskiego
create text search configuration if not exists polish (copy = simple);
alter text search configuration polish
  alter mapping for word, asciiword with simple;

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
  dimensions text,
  processing_status text default 'raw',
  importance_score float default 0.0,
  confidence_score float default 0.0,
  word_count integer default 0,
  access_level text default 'public',
  version text default '1.0'
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

<<<<<<< HEAD
-- Dodaj nowe indeksy dla lepszego wyszukiwania kontekstowego
create index if not exists documents_conversation_idx 
  on documents((metadata->>'conversation_id'));

create index if not exists documents_message_index_idx 
  on documents((metadata->>'message_index'));

create index if not exists documents_entities_idx 
  on documents using gin ((metadata->'entities'));

create index if not exists documents_temporal_idx 
  on documents using gin ((metadata->'temporal_references'));

-- Dodaj nowe indeksy dla metadanych
create index if not exists documents_entities_persons_idx 
  on documents using gin ((metadata->'entities'->'persons'));

create index if not exists documents_entities_locations_idx 
  on documents using gin ((metadata->'entities'->'locations'));

create index if not exists documents_temporal_dates_idx 
  on documents using gin ((metadata->'temporal'->'absolute_dates'));

create index if not exists documents_topics_idx 
  on documents using gin ((metadata->'topics'));

create index if not exists documents_importance_idx 
  on documents(((metadata->>'importance_score')::float));

create index if not exists documents_confidence_idx 
  on documents(((metadata->>'confidence_score')::float));

=======
>>>>>>> 1d11fc25fab466b081cf89edd1f5555edc1ad2aa
-- Usuń starą funkcję
drop function if exists match_documents;

-- Dodaj nową funkcję z jednoznaczną sygnaturą
create or replace function match_documents (
  query_embedding vector(3072),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_type text default null
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
    and (filter_type is null or d.metadata->>'media_type' = filter_type)
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
    ts_rank(to_tsvector('simple', d.content), plainto_tsquery('simple', search_query)) as rank
  from documents d
  where 
    to_tsvector('simple', d.content) @@ plainto_tsquery('simple', search_query)
    and (media_type is null or d.metadata->>'media_type' = media_type)
  order by rank desc;
end;
$$;

-- Funkcja do wyszukiwania z uwzględnieniem kontekstu
create or replace function search_with_context(
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  require_context boolean default true
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  context_before text,
  context_after text
)
language plpgsql
as $$
begin
  return query
  with matches as (
    select
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as similarity,
      d.source_document_id
    from documents d
    where 1 - (d.embedding <=> query_embedding) > match_threshold
  ),
  context as (
    select
      m.*,
      lag(d.content) over w as context_before,
      lead(d.content) over w as context_after
    from matches m
    left join documents d on 
      d.metadata->>'conversation_id' = m.metadata->>'conversation_id'
    window w as (
      partition by m.metadata->>'conversation_id' 
      order by (m.metadata->>'message_index')::int
    )
  )
  select
    c.id,
    c.content,
    c.metadata,
    c.similarity,
    coalesce(c.context_before, '') as context_before,
    coalesce(c.context_after, '') as context_after
  from context c
  where not require_context or (c.context_before is not null or c.context_after is not null)
  order by c.similarity desc
  limit match_count;
end;
$$;

-- Funkcja do wyszukiwania z filtrowaniem po metadanych
create or replace function search_with_metadata(
  query_embedding vector(3072),
  match_threshold float default 0.1,
  match_count int default 5,
  filter_params jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Dodaj funkcję testową do sprawdzenia embeddingów
create or replace function check_embeddings()
returns table (
  doc_count bigint,
  avg_embedding_length int,
  sample_content text,
  sample_similarity float
)
language sql
as $$
  select 
    count(*) as doc_count,
    avg(array_length(embedding, 1)) as avg_embedding_length,
    min(content) as sample_content,
    1 - (min(embedding) <=> min(embedding)) as sample_similarity
  from documents;
$$;

-- Dodaj funkcję do przeładowania cache'u
create or replace function reload_schema_cache()
returns void
language plpgsql
as $$
begin
  notify pgrst, 'reload schema';
end;
$$;

-- Uprawnienia
grant all privileges on all tables in schema public to postgres;
grant all privileges on all sequences in schema public to postgres;
grant execute on all functions in schema public to postgres;

-- Wyczyść istniejące dane
truncate table documents cascade;
truncate table source_documents cascade;

-- Nadaj uprawnienia
grant execute on function check_embeddings() to postgres;