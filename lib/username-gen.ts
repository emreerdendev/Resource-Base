import "server-only";

import { eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

type Db = DrizzleD1Database<typeof schema>;

/**
 * Letters that NFKD doesn't reduce to a-z: Turkish and other European ones,
 * plus Cyrillic and Greek, so a name keeps its sound (Ayşe → ayse, Groß →
 * gross, Иван → ivan). Scripts without letter-by-letter Latin (Arabic, CJK…)
 * fall back to the email address in usernameFor.
 */
const LATIN: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th",
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", ё: "e", є: "ye", ж: "zh", з: "z",
  и: "i", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l",
  μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f",
  χ: "ch", ψ: "ps", ω: "o",
};

export function usernameStem(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[İI]/g, "i")
    .toLowerCase()
    // Accents off first (ά → α, é → e), then the letter map.
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/./g, (c) => LATIN[c] ?? c)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
}

/** Stem from the name, else the email's local part, else "user". */
export function usernameFor(name: string | null | undefined, email: string): string {
  return usernameStem(name) || usernameStem(email.split("@")[0]) || "user";
}

const suffix = () => crypto.randomUUID().replace(/-/g, "").slice(0, 5);

/**
 * A free username for a stem: `stem` + a 5-character suffix (~1M per stem),
 * checked against the database (case-insensitively, like its unique index)
 * so the account insert that carries it doesn't collide. If the lookup
 * fails, a fresh candidate is still returned: the unique index stays the
 * final guard.
 */
export async function pickUsername(db: Db, stem: string): Promise<string> {
  const candidates = Array.from({ length: 6 }, () => `${stem}${suffix()}`);
  try {
    const taken = await db
      .select({ u: sql<string>`lower(${schema.user.username})` })
      .from(schema.user)
      .where(inArray(sql`lower(${schema.user.username})`, candidates));
    const used = new Set(taken.map((r) => r.u));
    return candidates.find((c) => !used.has(c)) ?? `${stem}${suffix()}`;
  } catch {
    return candidates[0];
  }
}

/**
 * Give an account that somehow has no username one now (self-repair for a
 * failed write; normally the username is set in the same insert as the
 * account). Returns the username, or null if it couldn't be saved.
 */
export async function ensureUsername(
  db: Db,
  account: { id: string; name: string | null; email: string },
): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    const username = await pickUsername(db, usernameFor(account.name, account.email));
    try {
      const updated = await db
        .update(schema.user)
        .set({ username })
        .where(
          sql`${schema.user.id} = ${account.id} and (${or(isNull(schema.user.username), eq(schema.user.username, ""))})`,
        )
        .returning({ username: schema.user.username });
      if (updated[0]?.username) return updated[0].username;
      // Another request set one meanwhile: use that.
      const [row] = await db
        .select({ username: schema.user.username })
        .from(schema.user)
        .where(eq(schema.user.id, account.id))
        .limit(1);
      return row?.username ?? null;
    } catch (e) {
      if (!String(e).includes("UNIQUE")) return null;
    }
  }
  return null;
}
