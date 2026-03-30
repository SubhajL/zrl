# ADR-0001: Persistence Strategy — Prisma for Schema, Raw SQL for Runtime

## Status

**Accepted** (2026-03-30)

## Context

ZRL is a NestJS modular monolith with PostgreSQL. The team needed a persistence approach that supports:

- Type-safe schema definition with migration tracking
- Full control over query optimization for analytics, aggregations, and cold-chain range queries
- Transaction-bound clone patterns for audit chain integrity
- Efficient batch operations without ORM overhead

## Decision

- **Prisma** is used exclusively for **schema definition and migrations** (`prisma/schema.prisma`, `prisma/migrations/`)
- **Raw SQL via `pg.Pool`** is used for **all runtime queries** in `*.pg-store.ts` files
- **Prisma Client is NOT used at runtime** — only in `prisma/seed.ts` for development seeding
- A shared `DATABASE_POOL` Symbol token (from `DatabaseModule`) provides a single `pg.Pool` instance to all stores

## Rationale

1. **Query control**: Analytics aggregations (COUNT/AVG/FILTER), cold-chain range queries, and evidence graph traversals require SQL that ORMs abstract away
2. **Transaction clones**: The `runInTransaction(callback)` pattern with `PoolClient` clones allows audit entries and business mutations to share the same transaction — critical for hash chain integrity
3. **Performance**: No ORM overhead on hot paths (evidence upload, temperature ingestion)
4. **Schema safety**: Prisma still provides migration tracking, schema validation, and generated types for seeding

## Consequences

- Every new module MUST create a `*.pg-store.ts` implementing a typed store interface from `*.types.ts`
- Every new module MUST define models in `prisma/schema.prisma` and generate migrations via `npx prisma migrate dev`
- Runtime code MUST NOT import `PrismaClient` or `@prisma/client` — only `pg` via the `DATABASE_POOL` token
- Queries use parameterized SQL (`$1, $2`) — never string interpolation

## Exceptions

- `prisma/seed.ts` uses `PrismaClient` for convenience seeding — this is development-only
- Future: if a module has purely CRUD operations with no aggregation needs, Prisma Client could be considered, but must be documented as a deviation

## Enforcement

- `CLAUDE.md` documents this decision in the "Persistence Strategy" section
- All 7+ existing stores follow this pattern consistently
- CI check (planned): fail if `PrismaClient` is imported outside `prisma/seed.ts`
