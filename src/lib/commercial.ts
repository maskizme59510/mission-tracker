type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function sanitizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function toCommercialCode(firstName: string, lastName: string): string | null {
  const first = sanitizeToken(firstName);
  const last = sanitizeToken(lastName);
  if (!first && !last) return null;

  const firstInitial = first.charAt(0);
  const lastPrefix = last.slice(0, 2);
  const raw = `${firstInitial}${lastPrefix}`.replace(/\s+/g, "");
  if (!raw) return null;
  return raw.toLocaleUpperCase("fr-FR");
}

export function normalizeCommercial(value: string | null | undefined): string | null {
  const trimmed = sanitizeToken(value);
  if (!trimmed) return null;
  return trimmed.toLocaleUpperCase("fr-FR");
}

export function deriveCommercialFromNames(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  return toCommercialCode(firstName ?? "", lastName ?? "");
}

export function deriveCommercialFromUser(user: UserLike): string | null {
  const metadata = user.user_metadata ?? {};
  const firstName =
    sanitizeToken((metadata.first_name as string | undefined) ?? (metadata.given_name as string | undefined)) ||
    sanitizeToken((metadata.prenom as string | undefined));
  const lastName =
    sanitizeToken((metadata.last_name as string | undefined) ?? (metadata.family_name as string | undefined)) ||
    sanitizeToken((metadata.nom as string | undefined));

  const fullName = sanitizeToken((metadata.full_name as string | undefined) ?? (metadata.name as string | undefined));
  const fullNameParts = fullName ? fullName.split(" ").filter(Boolean) : [];
  const fullNameFirst = fullNameParts[0] ?? "";
  const fullNameLast = fullNameParts[fullNameParts.length - 1] ?? "";

  const byMetadata = toCommercialCode(firstName || fullNameFirst, lastName || fullNameLast);
  if (byMetadata) return byMetadata;

  const emailLocalPart = sanitizeToken(user.email?.split("@")[0] ?? "");
  const emailParts = emailLocalPart.split(/[._-]+/).filter(Boolean);
  if (emailParts.length >= 2) {
    return toCommercialCode(emailParts[0], emailParts[1]);
  }
  if (emailParts.length === 1) {
    return toCommercialCode(emailParts[0], "");
  }
  return null;
}
