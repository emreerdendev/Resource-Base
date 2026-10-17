/**
 * Throwaway-inbox domains refused at sign-up: accounts made with them are
 * almost always for spam. A short list of the most used services — no lookup,
 * no cost. Subdomains match too ("x.mailinator.com").
 */
const DISPOSABLE = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com", "anonaddy.me",
  "burnermail.io", "dispostable.com", "dropmail.me", "emailondeck.com", "fakeinbox.com",
  "fakemail.net", "getnada.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "harakirimail.com", "inboxkitten.com", "maildrop.cc", "mailinator.com",
  "mailinator.net", "mailnesia.com", "mailpoof.com", "mintemail.com", "moakt.com",
  "mohmal.com", "mytemp.email", "nada.email", "sharklasers.com", "spam4.me",
  "spamgourmet.com", "temp-mail.io", "temp-mail.org", "tempail.com", "tempmail.com",
  "tempmail.net", "tempmailo.com", "tempr.email", "throwawaymail.com", "tmail.ws",
  "tmpmail.net", "tmpmail.org", "trashmail.com", "trashmail.de", "yopmail.com",
  "yopmail.fr", "yopmail.net", "emailfake.com", "fakemailgenerator.com", "mail.tm",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  if (!domain) return false;
  const parts = domain.split(".");
  // Check the domain and each parent ("a.b.mailinator.com" → "mailinator.com").
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
