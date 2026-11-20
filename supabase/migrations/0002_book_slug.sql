-- Add a URL-friendly slug to books so routes like /chat/pride-and-prejudice
-- resolve directly to a book row.
alter table books
  add column if not exists slug text unique;

create index if not exists books_slug_idx on books (slug);
