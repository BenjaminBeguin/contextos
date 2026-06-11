interface PathedMemory {
  title: string;
  content: string;
  paths: string[];
}

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const re = esc
    .replace(/\*\*/g, "§DS§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DS§/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + re + "$");
}

/** True if a single pattern matches a file. Globs match precisely; plain strings match as substrings. */
function patternMatches(pattern: string, file: string): boolean {
  if (!pattern.includes("*") && !pattern.includes("?")) {
    return file.includes(pattern);
  }
  return globToRegExp(pattern).test(file);
}

/** Tokens from a file path worth matching against memory text (dir + basename, len > 3). */
function fileTokens(file: string): string[] {
  return file
    .split(/[\/.]/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 3);
}

/**
 * Pick the memories relevant to a set of files. A memory matches if any of its
 * `paths` patterns match a file, OR (when it has no paths) a meaningful file
 * token appears in its title/content — so warnings work before paths are tagged.
 */
export function relevantToFiles<T extends PathedMemory>(memories: T[], files: string[]): T[] {
  return memories.filter((m) => {
    if (m.paths.length > 0) {
      return m.paths.some((p) => files.some((f) => patternMatches(p, f)));
    }
    const text = `${m.title} ${m.content}`.toLowerCase();
    return files.some((f) => fileTokens(f).some((tok) => text.includes(tok)));
  });
}
