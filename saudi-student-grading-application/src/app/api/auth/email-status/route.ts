export const dynamic = "force-dynamic";

/** هل مزوّد البريد مضبوط؟ (بدون كشف أي قيم سرية) */
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  return Response.json({
    ok: true,
    configured: Boolean(apiKey),
    provider: "Resend",
    from: process.env.RESEND_FROM || "onboarding@resend.dev",
  });
}
