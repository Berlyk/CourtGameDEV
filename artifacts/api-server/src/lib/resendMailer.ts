import https from "node:https";

type ResendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type HttpJsonResponse = {
  statusCode: number;
  body: any;
};

function postJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body, "utf8")),
          ...headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        });
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = { raw };
          }
          resolve({
            statusCode: response.statusCode ?? 500,
            body: parsed,
          });
        });
      },
    );
    request.on("error", (error) => reject(error));
    request.write(body);
    request.end();
  });
}

export async function sendResendEmail(input: ResendEmailInput): Promise<void> {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("Почтовый сервис не настроен: отсутствует RESEND_API_KEY.");
  }
  const fromRaw = String(process.env.RESEND_FROM_EMAIL ?? "").trim();
  if (!fromRaw) {
    throw new Error("Почтовый сервис не настроен: отсутствует RESEND_FROM_EMAIL.");
  }
  const from = fromRaw.includes("<") ? fromRaw : `CourtGame <${fromRaw}>`;

  const response = await postJson(
    "https://api.resend.com/emails",
    {
      Authorization: `Bearer ${apiKey}`,
    },
    {
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? "",
    },
  );

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return;
  }

  const resendMessage =
    typeof response.body?.message === "string" && response.body.message.trim()
      ? response.body.message.trim()
      : typeof response.body?.error?.message === "string" && response.body.error.message.trim()
        ? response.body.error.message.trim()
        : `HTTP ${response.statusCode}`;
  throw new Error(`Не удалось отправить письмо: ${resendMessage}`);
}
