import type { APIRoute } from "astro";

// Server endpoint (not prerendered). Sends contact-form enquiries to the spa
// via Resend. Needs these env vars set in Vercel to actually deliver:
//   RESEND_API_KEY      — Resend API key
//   CONTACT_TO_EMAIL    — where enquiries are sent (the spa's inbox)
//   CONTACT_FROM_EMAIL  — a verified sender, e.g. "Tree House Spa <enquiries@treehousespa.com.sg>"
export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const POST: APIRoute = async ({ request }) => {
  let data: Record<string, string> = {};
  try {
    const ctype = request.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      data = (await request.json()) as Record<string, string>;
    } else {
      data = Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
    }
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  // Honeypot: bots fill this hidden field.
  if ((data.company || "").trim()) return json({ ok: true });

  const name = (data.name || "").toString().trim();
  const phone = (data.phone || "").toString().trim();
  const email = (data.email || "").toString().trim();
  const message = (data.message || "").toString().trim();

  if (!name) return json({ ok: false, error: "missing_name" }, 400);
  if (!phone) return json({ ok: false, error: "missing_phone" }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400);
  if (name.length > 120 || phone.length > 40 || email.length > 160 || message.length > 4000) {
    return json({ ok: false, error: "too_long" }, 400);
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CONTACT_TO_EMAIL;
  const from = import.meta.env.CONTACT_FROM_EMAIL || "Tree House Spa <onboarding@resend.dev>";
  if (!apiKey || !to) {
    // Not wired up yet — tell the client so it can show the "please call us" fallback.
    console.error("Contact form: RESEND_API_KEY or CONTACT_TO_EMAIL not configured");
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const html = `
    <h2>New enquiry from treehousespa.com.sg</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Phone:</strong> ${esc(phone)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Message:</strong><br>${esc(message || "(none)").replace(/\n/g, "<br>")}</p>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from, to, replyTo: email,
      subject: `New enquiry from ${name}`,
      html,
      text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\n\n${message}`,
    });
    if (error) {
      console.error("Resend error:", error);
      return json({ ok: false, error: "send_failed" }, 502);
    }
  } catch (e) {
    console.error("Contact send failed:", e);
    return json({ ok: false, error: "send_failed" }, 502);
  }

  return json({ ok: true });
};
