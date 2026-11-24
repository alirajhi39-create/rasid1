// =========================================================================
// إرسال البريد — Brevo (يُفعَّل تلقائياً مع BREVO_API_KEY)
// عند غياب المفتاح يُعاد الرابط مباشرةً في الاستجابة لوضع الاختبار
// =========================================================================

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
  const apiKey = process.env.BREVO_API_KEY;
  const link = `${opts.siteOrigin}/reset-password?token=${opts.token}`;

  if (!apiKey) {
    return { configured: false, devLink: link };
  }

  const senderEmail = process.env.BREVO_FROM_EMAIL || "ali.rajhi39@gmail.com";
  const senderName = process.env.BREVO_FROM_NAME || "منظومة رصد";

  const html = `
    <div dir="rtl" style="font-family:Tahoma,Segoe UI,sans-serif;background:#f4f5f0;padding:24px;">
      <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e7e0;">
        <div style="background:linear-gradient(160deg,#0e5c3a,#062e1f);padding:20px 24px;color:#fff;">
          <div style="font-size:22px;font-weight:900;">رصد</div>
          <div style="font-size:12px;color:#e7cf9a;">منظومة تقويم ورصد درجات الطلاب</div>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px;color:#16241d;margin:0 0 8px;">مرحباً ${opts.teacherName}</p>
          <p style="font-size:14px;color:#3c4f44;line-height:1.8;margin:0 0 16px;">
            تم طلب استعادة كلمة المرور لحسابك في منظومة رصد. اضغط الزر أدناه لتعيين كلمة مرور جديدة.
            إن لم تكن أنت من قام بالطلب يمكنك تجاهل هذه الرسالة بأمان.
          </p>
          <a href="${link}" style="display:block;text-align:center;background:#0e5c3a;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:12px 20px;border-radius:10px;">
            استعادة كلمة المرور
          </a>
          <p style="font-size:12px;color:#8a968d;margin-top:16px;">
            هذا الرابط صالح لمدة ساعة واحدة فقط.<br/>أو انسخ الرابط: ${link}
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: opts.to,
            name: opts.teacherName,
          },
        ],
        subject: "استعادة كلمة المرور - منظومة رصد",
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        configured: true,
        error: errData.message || `تعذر إرسال البريد (${res.status})`,
      };
    }

    return { configured: true };
  } catch (err: unknown) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : "خطأ في الاتصال بخدمة البريد",
    };
  }
}
