-- Włącz rozszerzenie vector
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector;

-- Usuń istniejącą tabelę i funkcję jeśli istnieją
DROP TABLE IF EXISTS books;
DROP FUNCTION IF EXISTS match_books;

-- Utwórz tabelę books
CREATE TABLE books (
    id bigserial primary key,
    isbn text unique not null,
    author text not null,
    title text not null,
    text text not null,
    embedding vector(3072)
);

-- Tworzymy indeks dla wyszukiwania pełnotekstowego
CREATE INDEX books_text_idx ON books USING gin (to_tsvector('english', text));
CREATE INDEX books_title_idx ON books USING gin (to_tsvector('english', title));
CREATE INDEX books_author_idx ON books USING gin (to_tsvector('english', author));

-- Usuwamy indeks wektorowy całkowicie

-- Funkcja do wyszukiwania podobnych dokumentów
CREATE OR REPLACE FUNCTION match_books (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  isbn text,
  author text,
  title text,
  text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    books.id,
    books.isbn,
    books.author,
    books.title,
    books.text,
    1 - (books.embedding <=> query_embedding) AS similarity
  FROM books
  WHERE 1 - (books.embedding <=> query_embedding) > match_threshold
  ORDER BY books.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja do wyszukiwania pełnotekstowego
CREATE OR REPLACE FUNCTION search_books(
  query_text text,
  match_count int
)
RETURNS TABLE (
  id bigint,
  isbn text,
  author text,
  title text,
  text text,
  rank double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    books.id,
    books.isbn,
    books.author,
    books.title,
    books.text,
    ts_rank(
      setweight(to_tsvector('english', books.title), 'A') ||
      setweight(to_tsvector('english', books.author), 'B') ||
      setweight(to_tsvector('english', books.text), 'C'),
      to_tsquery('english', query_text)
    )::double precision as rank
  FROM books
  WHERE 
    to_tsvector('english', books.title) @@ to_tsquery('english', query_text) OR
    to_tsvector('english', books.author) @@ to_tsquery('english', query_text) OR
    to_tsvector('english', books.text) @@ to_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Funkcja do wyszukiwania po ISBN
CREATE OR REPLACE FUNCTION get_book_by_isbn(
  search_isbn text
)
RETURNS TABLE (
  id bigint,
  isbn text,
  author text,
  title text,
  text text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    books.id,
    books.isbn,
    books.author,
    books.title,
    books.text
  FROM books
  WHERE books.isbn = search_isbn;
END;
$$;

-- Nadaj uprawnienia
GRANT ALL ON TABLE books TO postgres;
GRANT ALL ON SEQUENCE books_id_seq TO postgres;
GRANT EXECUTE ON FUNCTION match_books(vector(3072), float, int) TO postgres;
GRANT ALL ON TABLE books TO anon;
GRANT ALL ON SEQUENCE books_id_seq TO anon;
GRANT EXECUTE ON FUNCTION match_books(vector(3072), float, int) TO anon;
GRANT EXECUTE ON FUNCTION search_books(text, int) TO postgres;
GRANT EXECUTE ON FUNCTION search_books(text, int) TO anon;
GRANT EXECUTE ON FUNCTION get_book_by_isbn(text) TO postgres;
GRANT EXECUTE ON FUNCTION get_book_by_isbn(text) TO anon; 