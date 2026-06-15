/**
 * Resend email helper. Server-only. Requires:
 *  - RESEND_API_KEY     : Resend API key
 *  - REPORT_EMAIL_FROM  : verified sender, e.g. "Wegmans Floorcare <reports@yourdomain.com>"
 */
import { Resend } from "resend";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  if (!from)
    throw new Error(
      "REPORT_EMAIL_FROM is not configured (e.g. 'Wegmans Floorcare <reports@yourdomain.com>')."
    );

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return { id: data?.id ?? null };
}
