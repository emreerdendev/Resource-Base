// Email templates. Inline CSS only (email clients strip <style>/external CSS).
// Kept simple and on-brand — no heavy design.

const BRAND = "Resource Base";
const ACCENT = "#694ce6";
const SITE = "https://resource-base.com";

function shell(opts: { heading: string; intro: string; cta?: { label: string; url: string }; outro?: string }): string {
  const { heading, intro, cta, outro } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0b12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b12;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#16121f;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
            <tr>
              <td style="padding:28px 32px 8px;">
                <span style="display:inline-block;font-size:18px;font-weight:700;color:#ffffff;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">${heading}</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#b8b3c7;">${intro}</p>
              </td>
            </tr>
            ${
              cta
                ? `<tr><td style="padding:0 32px 8px;">
                <a href="${cta.url}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">${cta.label}</a>
              </td></tr>
              <tr><td style="padding:8px 32px 0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#7c7790;word-break:break-all;">${cta.url}</p>
              </td></tr>`
                : ""
            }
            ${outro ? `<tr><td style="padding:16px 32px 0;"><p style="margin:0;font-size:12px;line-height:1.6;color:#7c7790;">${outro}</p></td></tr>` : ""}
            <tr>
              <td style="padding:24px 32px 28px;">
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 16px;" />
                <p style="margin:0;font-size:12px;color:#5f5b72;">
                  <a href="${SITE}" style="color:#7c7790;text-decoration:none;">${SITE.replace("https://", "")}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function resetPasswordEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `Reset your ${BRAND} password`,
    html: shell({
      heading: "Reset your password",
      intro:
        "We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.",
      cta: { label: "Reset password", url },
      outro:
        "If you didn't request this, you can safely ignore this email — your password won't change.",
    }),
    text: `Reset your ${BRAND} password\n\nWe received a request to reset your password. Open this link to choose a new one (expires in 1 hour):\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
  };
}

export function verifyEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `Verify your ${BRAND} email`,
    html: shell({
      heading: "Confirm your email",
      intro:
        "Welcome to Resource Base! Confirm your email address to activate your account and sign in. This link expires in 1 hour.",
      cta: { label: "Verify email", url },
      outro:
        "If you didn't create this account, you can safely ignore this email — no account will be activated.",
    }),
    text: `Verify your ${BRAND} email\n\nConfirm your email address to activate your account. Open this link (expires in 1 hour):\n\n${url}\n\nIf you didn't create this account, you can safely ignore this email.`,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** A suggested new resource or company was approved and is live. */
export function approvalEmail(opts: { kind: "resource" | "company"; name: string; url: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const what = opts.kind === "company" ? "company" : "resource";
  const name = opts.name.trim().slice(0, 200);
  const heading = opts.kind === "company" ? "Your company suggestion was approved" : "Your resource was approved";
  const live = `“${name}” is now live in the ${BRAND} directory. Thanks for contributing — it counts toward your contributor badge.`;
  return {
    subject: `${heading} 🎉`,
    html: shell({
      heading: escapeHtml(heading),
      intro: escapeHtml(live),
      cta: { label: `View ${what}`, url: opts.url },
      outro: `You're receiving this because you suggested it on ${BRAND}.`,
    }),
    text: `${heading}\n\n${live}\n\nView it: ${opts.url}\n\nYou're receiving this because you suggested it on ${BRAND}.`,
  };
}
