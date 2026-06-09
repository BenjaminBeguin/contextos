// @prisma/client is CommonJS; under ESM the named export isn't statically
// detectable, so default-import the module object and destructure.
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

export const prisma = new PrismaClient();
