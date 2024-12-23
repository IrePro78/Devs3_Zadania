-- Włącz rozszerzenie vector
create extension if not exists vector;

-- Tabela na dokumenty z wektorami
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(3072),
  metadata jsonb not null default '{}'::jsonb,
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
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Indeks dla szybszego wyszukiwania wektorowego
create index on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Uprawnienia
grant all on table documents to postgres;
grant all on sequence documents_id_seq to postgres;
grant execute on function match_documents(vector(3072), float, int) to postgres;