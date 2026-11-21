-- Support zero-file book acquisition (public-domain imports, pasted text/URLs, and no-file author chats).
alter table books
  add column if not exists external_id text unique;

alter table books
  drop constraint if exists books_source_check;

alter table books
  add constraint books_source_check
  check (source in ('public_domain', 'upload', 'text_paste', 'no_file'));

create index if not exists books_external_id_idx on books (external_id);
