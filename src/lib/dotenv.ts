// A line-aware .env representation. Parsing keeps every line — including
// comments and blank lines — so editing a single value and saving never
// destroys the rest of the user's file.
export type DotenvLine =
  | { kind: "pair"; key: string; value: string }
  | { kind: "comment"; raw: string }
  | { kind: "blank" };

/** Parse raw .env text into a line-by-line structure. */
export function parse(content: string): DotenvLine[] {
  const lines = content.split(/\r?\n/);
  // A trailing newline yields a final empty element; drop it so the file
  // doesn't grow a phantom blank line on every save round-trip.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  return lines.map((raw): DotenvLine => {
    const trimmed = raw.trimStart();
    if (trimmed === "") return { kind: "blank" };
    if (trimmed.startsWith("#")) return { kind: "comment", raw };

    const eq = raw.indexOf("=");
    // A line with no '=' isn't a valid pair — keep it verbatim so we never
    // silently drop content we don't understand.
    if (eq === -1) return { kind: "comment", raw };

    const key = raw.slice(0, eq).trim();
    const value = stripQuotes(raw.slice(eq + 1).trim());
    return { kind: "pair", key, value };
  });
}

/** Serialize back to .env text, preserving comments and blank lines. */
export function serialize(lines: DotenvLine[]): string {
  const out = lines.map((line) => {
    switch (line.kind) {
      case "blank":
        return "";
      case "comment":
        return line.raw;
      case "pair":
        return `${line.key}=${formatValue(line.value)}`;
    }
  });
  return out.join("\n") + "\n";
}

function stripQuotes(v: string): string {
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

// Wrap in double quotes when the value has whitespace, a '#', quotes, or '='
// that would otherwise change its meaning when the file is read back.
function formatValue(v: string): string {
  if (v === "") return "";
  if (/[\s#"'=]/.test(v) || v !== v.trim()) {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}
