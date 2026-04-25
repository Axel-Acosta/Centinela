const LEGAL_SUFFIX_TOKENS = new Set([
  "s",
  "sa",
  "srl",
  "sacr",
  "saci",
  "saeca",
  "sacei",
  "sac",
  "sr",
  "ltda",
  "limitada",
  "limited",
  "ltd",
  "llc",
  "inc",
  "corp",
  "corporation",
  "company",
  "cia",
  "cias",
  "compania",
  "compañia",
  "comercial",
  "industrial",
  "e",
  "i",
  "de",
  "del",
  "la",
]);

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEntityName(value: string): string {
  return collapseWhitespace(
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " "),
  );
}

export function coreEntityName(value: string): string {
  const tokens = normalizeEntityName(value)
    .split(" ")
    .filter((token) => token.length > 0 && !LEGAL_SUFFIX_TOKENS.has(token));

  return collapseWhitespace(tokens.join(" "));
}

export function normalizeLooseIdentifier(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function splitSemicolonList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((item) => collapseWhitespace(item))
    .filter((item) => item.length > 0);
}
