/**
 * The client IP for per-IP limits. IPv6 is cut to its /64 — one subscriber
 * typically owns a whole /64, so per-address limits would be trivial to rotate.
 */
export function clientIp(headers: Headers): string {
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!ip.includes(":")) return ip;
  // Expand "::" so equal /64 prefixes compare equal however they're written.
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":");
}
