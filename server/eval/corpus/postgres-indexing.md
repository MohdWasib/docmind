# PostgreSQL indexing

The default index type is B-tree, which handles equality and range queries and supports sorting. For full-text search and JSONB containment queries, use a GIN index, which maps each element or word to the rows that contain it.

In a composite index, column order matters. An index on (user_id, created_at) can serve queries that filter on user_id alone or on both columns, but it cannot efficiently serve a query that filters only on created_at. Put the most selective equality column first and range columns last.

A partial index covers only rows matching a condition, such as `WHERE deleted_at IS NULL`, which keeps the index small. Use `EXPLAIN ANALYZE` to see the real execution plan and timings; a sequential scan on a large table usually signals a missing index.

Every index speeds up reads but slows down writes, since each INSERT and UPDATE must maintain it.
