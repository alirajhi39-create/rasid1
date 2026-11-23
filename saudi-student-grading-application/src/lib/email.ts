// ============================================================
//  إرسال البريد — Resend (يفعّل تلقائياً مع RESEND_API_KEY)
//  عند غياب المفتاح يُعاد الرابط مباشرةً في الاستجابة لوضع الاختبار
// ============================================================

export type SendResult = {
  configured: boolean;
  devLink?: string;
  error?: string;
};

export async function sendResetEmail(opts: {
  to: string;
  teacherName: string;
  siteOrigin: string;
  token: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { configured: false, devLink: `${opts.siteOrigin}/reset-password?token=${opts.token}` };

  const from = process.env.RESEND_FROM || "Rased <onboarding@resend.dev>";
  const link = `${opts.siteOrigin}/reset-password?token=${opts.token}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Segoe UI,sans-serif;background:#f4f5f0;padding:24px;">
      <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e7e0;">
        <div style="background:linear-gradient(160deg,#0e5c3a,#062e1f);padding:20px 24px;color:#fff;">
          <div style="font-size:22px;font-weight:900;">رَصْد</div>
          <div style="font-size:12px;color:#e7cf9a;">منظومة تقويم ورصد درجات الطلاب</div>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px;color:#16241d;margin:0 0 8px;">مرحباً ${opts.teacherName}،</p>
          <p style="font-size:14px;color:#3c4f44;line-height:1.8;margin:0 0 16px;">
            تم طلب استعادة كلمة المرور لحسابك في منظومة رَصْد. اضغط الزر أدناه لتعيين كلمة مرور جديدة.
            إن لم تكن أنت من قام بالطلب يمكنك تجاهل هذه الرسالة بأمان.
          </p>
          <a href="${link}" style="display:block;text-align:center;background:#0e5c3a;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px;border-radius:12px;">
            استعادة كلمة المرور
          </a>
          <p style="font-size:12px;color:#8a968d;margin-top:18px;">هذا الرابط صالح لمدة ساعة واحدة فقط.<br />أو انسخ الرابط: ${link}</p>
        </div>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: "استعادة كلمة المرور — منظومة رَصْد", html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { configured: true, error: data?.message ?? `HTTP ${res.status}` };
    return { configured: true };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : "فشل الإرسال" };
  }
}
