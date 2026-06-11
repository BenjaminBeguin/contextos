-- File globs a memory applies to, for just-in-time risk warnings.
ALTER TABLE "Memory" ADD COLUMN "paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
