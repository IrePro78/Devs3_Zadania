-- Włącz rozszerzenie vector
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector;

-- Usuń istniejącą tabelę i funkcję jeśli istnieją
DROP TABLE IF EXISTS documents;
DROP FUNCTION IF EXISTS match_documents;

-- Utwórz tabelę documents
CREATE TABLE documents (
    id bigserial primary key,
    content text,
    metadata jsonb,
    embedding vector(3072),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Funkcja do wyszukiwania podobnych dokumentów
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Nadaj uprawnienia
GRANT ALL ON TABLE documents TO postgres;
GRANT ALL ON SEQUENCE documents_id_seq TO postgres;
GRANT EXECUTE ON FUNCTION match_documents(vector(3072), float, int) TO postgres;
GRANT ALL ON TABLE documents TO anon;
GRANT ALL ON SEQUENCE documents_id_seq TO anon;
GRANT EXECUTE ON FUNCTION match_documents(vector(3072), float, int) TO anon; 