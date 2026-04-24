export function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function fromLines(values: string[]): string {
  return values.join("\n");
}

export function toFrenchDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}
