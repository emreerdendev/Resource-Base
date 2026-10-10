const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

/**
 * URL slug with Turkish characters transliterated ("Çiçek Sepeti" →
 * "cicek-sepeti"). Shared by the company import, company suggestions and the
 * tracker CSV import, so the same name always maps to the same slug / _id.
 */
export function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
