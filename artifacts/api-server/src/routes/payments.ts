import crypto from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { assignSubscriptionByUserId, getUserByToken } from "../lib/authStore.js";
import {
  normalizeSubscriptionDuration,
  normalizeSubscriptionTier,
  type SubscriptionDuration,
  type SubscriptionTier,
} from "../lib/subscriptions.js";

const paymentsRouter = Router();

type PaymentRegion = "cis" | "crypto";
type PaidTier = Exclude<SubscriptionTier, "free">;
type PaidDuration = Extract<SubscriptionDuration, "1_month" | "1_year">;

const PAID_TIERS = new Set<PaidTier>(["trainee", "practitioner", "arbiter"]);
const PAID_DURATIONS = new Set<PaidDuration>(["1_month", "1_year"]);
const CIS_METHOD_IDS = new Set<number>([4, 12, 42, 11, 7]);
const CRYPTO_METHOD_IDS = new Set<number>([14, 15, 17, 19, 23, 24, 25, 26, 34, 39]);

const PRICE_MATRIX_RUB: Record<PaidTier, Record<PaidDuration, number>> = {
  trainee: { "1_month": 250, "1_year": 2500 },
  practitioner: { "1_month": 500, "1_year": 5000 },
  arbiter: { "1_month": 800, "1_year": 8000 },
};

let initPromise: Promise<void> | null = null;

function readBearerToken(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith("bearer ")) {
    const token = raw.slice(7).trim();
    return token || null;
  }
  return raw;
}

function getRequestToken(headers: Record<string, unknown>): string | null {
  const authorization = headers["authorization"];
  if (typeof authorization === "string") {
    return readBearerToken(authorization);
  }
  const xAuth = headers["x-auth-token"];
  if (typeof xAuth === "string") {
    return readBearerToken(xAuth);
  }
  return null;
}

function resolveClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] ?? "").trim();
  }
  return String(req.ip ?? "").trim();
}

function readFreeKassaConfig() {
  const shopId = String(
    process.env.FREEKASSA_SHOP_ID ??
      process.env.FREEKASSA_MERCHANT_ID ??
      process.env.FREEKASSA_SHOPID ??
      "",
  ).trim();
  const secret1 = String(
    process.env.FREEKASSA_SECRET_WORD_1 ?? process.env.FREEKASSA_SECRET1 ?? "",
  ).trim();
  const apiKey = String(
    process.env.FREEKASSA_API_KEY ?? process.env.FREEKASSA_ORDER_API_KEY ?? "",
  ).trim();
  const secret2 = String(
    process.env.FREEKASSA_SECRET_WORD_2 ?? process.env.FREEKASSA_SECRET2 ?? "",
  ).trim();
  const publicAppUrl = String(process.env.PUBLIC_APP_URL ?? "").trim();
  return { shopId, secret1, apiKey, secret2, publicAppUrl };
}

function buildApiSignature(payload: Record<string, string | number>, apiKey: string): string {
  const serialized = Object.keys(payload)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => String(payload[key] ?? ""))
    .join("|");
  return crypto.createHmac("sha256", apiKey).update(serialized, "utf8").digest("hex");
}

function createMerchantOrderId(): string {
  return `cg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function ensurePaymentTables(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_payment_orders (
        id UUID PRIMARY KEY,
        provider TEXT NOT NULL,
        payment_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        duration TEXT NOT NULL,
        amount_rub INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'RUB',
        region TEXT NOT NULL,
        method_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        fk_order_id BIGINT,
        fk_order_hash TEXT,
        fk_location TEXT,
        fk_payload JSONB,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_payment_orders_user_created
      ON auth_payment_orders(user_id, created_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_payment_orders_status
      ON auth_payment_orders(status)
    `);
  })();
  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

function parseNumericAmount(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function safeJsonPayload(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
}

function pickPayloadValue(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

paymentsRouter.post("/payments/freekassa/create", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Session is invalid." });
  }

  const { shopId, secret1, apiKey, publicAppUrl } = readFreeKassaConfig();
  if (!shopId) {
    return res.status(503).json({ message: "FreeKassa is not configured on the server." });
  }

  const tier = normalizeSubscriptionTier(String(req.body?.tier ?? "").trim());
  if (!PAID_TIERS.has(tier as PaidTier)) {
    return res.status(400).json({ message: "Invalid subscription plan." });
  }
  const duration = normalizeSubscriptionDuration(String(req.body?.duration ?? "").trim());
  if (!PAID_DURATIONS.has(duration as PaidDuration)) {
    return res
      .status(400)
      .json({ message: "Only 1 month and 1 year durations are available for payment." });
  }

  const regionRaw = String(req.body?.category ?? "").trim().toLowerCase();
  if (regionRaw === "europe") {
    return res.status(400).json({ message: "Europe payment provider is not available yet." });
  }
  if (regionRaw !== "cis" && regionRaw !== "crypto") {
    return res.status(400).json({ message: "Invalid payment region." });
  }
  const region = regionRaw as PaymentRegion;

  const methodId = Number(req.body?.paymentSystemId);
  if (!Number.isFinite(methodId) || methodId <= 0) {
    return res.status(400).json({ message: "Invalid payment method." });
  }
  if (region === "cis" && !CIS_METHOD_IDS.has(methodId)) {
    return res.status(400).json({ message: "Method is not available for CIS payments." });
  }
  if (region === "crypto" && !CRYPTO_METHOD_IDS.has(methodId)) {
    return res.status(400).json({ message: "Method is not available for crypto payments." });
  }

  const paidTier = tier as PaidTier;
  const paidDuration = duration as PaidDuration;
  const amountRub = PRICE_MATRIX_RUB[paidTier][paidDuration];
  const paymentId = createMerchantOrderId();
  const clientIp = resolveClientIp(req) || "127.0.0.1";
  const nonce = Date.now();
  let checkoutUrl = "";
  let fkPayload: Record<string, unknown> = {};

  if (secret1) {
    const amountForSign = amountRub.toFixed(2);
    const signature = crypto
      .createHash("md5")
      .update(`${shopId}:${amountForSign}:${secret1}:${paymentId}`, "utf8")
      .digest("hex");
    const checkout = new URL("https://pay.freekassa.ru/");
    checkout.searchParams.set("m", shopId);
    checkout.searchParams.set("oa", amountForSign);
    checkout.searchParams.set("o", paymentId);
    checkout.searchParams.set("s", signature);
    checkout.searchParams.set("currency", "RUB");
    checkout.searchParams.set("lang", "ru");
    checkout.searchParams.set("i", String(methodId));
    checkout.searchParams.set("em", user.email);
    checkout.searchParams.set("us_userId", user.id);
    checkout.searchParams.set("us_tier", paidTier);
    checkout.searchParams.set("us_duration", paidDuration);
    if (publicAppUrl) {
      const successUrl = new URL(publicAppUrl);
      successUrl.searchParams.set("payment", "success");
      const failUrl = new URL(publicAppUrl);
      failUrl.searchParams.set("payment", "fail");
      checkout.searchParams.set("success_url", successUrl.toString());
      checkout.searchParams.set("fail_url", failUrl.toString());
    }
    checkoutUrl = checkout.toString();
    fkPayload = {
      mode: "redirect",
      signature,
      shopId,
      paymentId,
      amount: amountForSign,
      methodId,
    };
  } else if (apiKey) {
    const payloadBase: Record<string, string | number> = {
      amount: amountRub,
      currency: "RUB",
      email: user.email,
      i: methodId,
      ip: clientIp,
      nonce,
      paymentId,
      shopId,
    };
    const signature = buildApiSignature(payloadBase, apiKey);

    const fkResponse = await fetch("https://api.fk.life/v1/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payloadBase,
        signature,
      }),
    }).catch(() => null);

    if (!fkResponse) {
      return res.status(502).json({ message: "Failed to connect to FreeKassa." });
    }

    const apiPayload: any = await fkResponse.json().catch(() => null);
    if (!fkResponse.ok || !apiPayload || apiPayload.type !== "success" || !apiPayload.location) {
      const message =
        String(apiPayload?.message ?? apiPayload?.msg ?? apiPayload?.error ?? "").trim() ||
        "FreeKassa returned an error while creating payment.";
      return res.status(502).json({ message });
    }
    checkoutUrl = String(apiPayload.location ?? "").trim();
    fkPayload = safeJsonPayload(apiPayload) as Record<string, unknown>;
  } else {
    return res.status(503).json({
      message:
        "FreeKassa is not configured on the server. Set FREEKASSA_SECRET_WORD_1 or FREEKASSA_API_KEY.",
    });
  }

  if (!checkoutUrl) {
    return res.status(502).json({ message: "FreeKassa did not return checkout URL." });
  }

  await ensurePaymentTables();
  await pool.query(
    `
      INSERT INTO auth_payment_orders (
        id,
        provider,
        payment_id,
        user_id,
        tier,
        duration,
        amount_rub,
        currency,
        region,
        method_id,
        status,
        fk_order_id,
        fk_order_hash,
        fk_location,
        fk_payload,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'created',$11,$12,$13,$14,NOW()
      )
    `,
    [
      crypto.randomUUID(),
      "freekassa",
      paymentId,
      user.id,
      paidTier,
      paidDuration,
      amountRub,
      "RUB",
      region,
      methodId,
      typeof fkPayload["orderId"] === "number" ? (fkPayload["orderId"] as number) : null,
      String(fkPayload["orderHash"] ?? "").trim() || null,
      checkoutUrl,
      JSON.stringify(safeJsonPayload(fkPayload)),
    ],
  );

  return res.status(200).json({
    ok: true,
    paymentId,
    checkoutUrl,
  });
});

const freeKassaCallbackHandler = async (req: Request, res: Response) => {
  const { shopId, secret2 } = readFreeKassaConfig();
  if (!shopId || !secret2) {
    return res.status(503).type("text/plain").send("FreeKassa callback is not configured");
  }

  await ensurePaymentTables();

  const source = (req.method === "GET" ? req.query : req.body) as Record<string, unknown>;
  const merchantId = pickPayloadValue(source, ["MERCHANT_ID", "merchant_id", "shopId"]);
  const amountRaw = pickPayloadValue(source, ["AMOUNT", "amount"]);
  const merchantOrderId = pickPayloadValue(source, [
    "MERCHANT_ORDER_ID",
    "merchant_order_id",
    "payment_id",
    "paymentId",
  ]);
  const signRaw = pickPayloadValue(source, ["SIGN", "sign", "signature"]);

  if (!merchantId || !amountRaw || !merchantOrderId || !signRaw) {
    return res.status(400).type("text/plain").send("Missing callback params");
  }
  if (merchantId !== shopId) {
    return res.status(400).type("text/plain").send("Invalid merchant");
  }

  const expectedSign = crypto
    .createHash("md5")
    .update(`${merchantId}:${amountRaw}:${secret2}:${merchantOrderId}`, "utf8")
    .digest("hex");
  if (!secureCompare(signRaw.toLowerCase(), expectedSign.toLowerCase())) {
    return res.status(403).type("text/plain").send("Invalid signature");
  }

  const paymentResult = await pool.query<{
    user_id: string;
    tier: string;
    duration: string;
    amount_rub: number;
    status: string;
  }>(
    `
      SELECT user_id, tier, duration, amount_rub, status
      FROM auth_payment_orders
      WHERE payment_id = $1
      LIMIT 1
    `,
    [merchantOrderId],
  );
  if (!paymentResult.rowCount) {
    return res.status(404).type("text/plain").send("Payment not found");
  }
  const payment = paymentResult.rows[0];
  if (payment.status === "paid") {
    return res.status(200).type("text/plain").send("YES");
  }

  const callbackAmount = parseNumericAmount(amountRaw);
  if (callbackAmount === null) {
    return res.status(400).type("text/plain").send("Invalid amount");
  }
  const expectedAmount = Number(payment.amount_rub);
  if (!Number.isFinite(expectedAmount) || Math.abs(callbackAmount - expectedAmount) > 0.001) {
    return res.status(400).type("text/plain").send("Amount mismatch");
  }

  const subscription = await assignSubscriptionByUserId({
    userId: payment.user_id,
    tier: payment.tier,
    duration: payment.duration,
    source: "system",
  });
  if (!subscription) {
    return res.status(404).type("text/plain").send("User not found");
  }

  await pool.query(
    `
      UPDATE auth_payment_orders
      SET
        status = 'paid',
        paid_at = NOW(),
        fk_payload = $2,
        updated_at = NOW()
      WHERE payment_id = $1
    `,
    [merchantOrderId, JSON.stringify(safeJsonPayload(source))],
  );

  return res.status(200).type("text/plain").send("YES");
};

paymentsRouter.all("/payments/freekassa", freeKassaCallbackHandler);
paymentsRouter.all("/payments/freekassa/", freeKassaCallbackHandler);
paymentsRouter.all("/payments/freekassa/notify", freeKassaCallbackHandler);

export default paymentsRouter;
