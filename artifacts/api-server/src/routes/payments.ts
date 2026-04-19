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

type PaymentRegion = "cis" | "crypto" | "europe";
type PaidTier = Exclude<SubscriptionTier, "free">;
type PaidDuration = Extract<SubscriptionDuration, "1_month" | "1_year">;
type TomeSettlementMethod = "card" | "sbp";
type PayPalCheckoutMode = "paypal" | "paypal_cards";

const PAID_TIERS = new Set<PaidTier>(["trainee", "practitioner", "arbiter"]);
const PAID_DURATIONS = new Set<PaidDuration>(["1_month", "1_year"]);
const CIS_METHOD_IDS = new Set<number>([4, 8, 12, 42]);
const CRYPTO_METHOD_IDS = new Set<number>([15, 26, 41]);
const TOME_CARD_METHOD_IDS = new Set<number>([4, 8, 12]);
const TOME_SBP_METHOD_IDS = new Set<number>([42]);
const PAYPAL_METHOD_IDS = new Set<number>([201, 202]);
const PAYPAL_ONLY_METHOD_IDS = new Set<number>([201]);
const PAYPAL_CARDS_METHOD_IDS = new Set<number>([202]);

const PRICE_MATRIX_RUB: Record<PaidTier, Record<PaidDuration, number>> = {
  trainee: { "1_month": 250, "1_year": 2500 },
  practitioner: { "1_month": 500, "1_year": 5000 },
  arbiter: { "1_month": 800, "1_year": 8000 },
};

const PRICE_MATRIX_EUR: Record<PaidTier, Record<PaidDuration, number>> = {
  trainee: { "1_month": 2.5, "1_year": 25 },
  practitioner: { "1_month": 5, "1_year": 50 },
  arbiter: { "1_month": 8, "1_year": 80 },
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
      process.env.FREEKASSA_MERCHANTID ??
      process.env.FREEKASSA_MERCHANT ??
      process.env.FREEKASSA_ID ??
      process.env.FREEKASSA_SHOPID ??
      process.env.FREEKASSA_CASHBOX_ID ??
      process.env.FK_MERCHANT_ID ??
      process.env.FK_SHOP_ID ??
      "",
  ).trim();
  const secret1 = String(
    process.env.FREEKASSA_SECRET_WORD_1 ??
      process.env.FREEKASSA_SECRET_WORD1 ??
      process.env.FREEKASSA_SECRET_WORD ??
      process.env.FREEKASSA_SECRET_1 ??
      process.env.FREEKASSA_SECRET1 ??
      process.env.FREEKASSA_CASHBOX_SECRET_1 ??
      process.env.FREEKASSA_PASSWORD_1 ??
      process.env.FREEKASSA_PASSWORD1 ??
      process.env.FK_SECRET_1 ??
      process.env.FK_SECRET1 ??
      "",
  ).trim();
  const apiKey = String(
    process.env.FREEKASSA_API_KEY ??
      process.env.FREEKASSA_ORDER_API_KEY ??
      process.env.FREEKASSA_CASHBOX_API_KEY ??
      process.env.FREEKASSA_CASHBOX_APIKEY ??
      process.env.FREEKASSA_CASH_API_KEY ??
      process.env.FREEKASSA_MERCHANT_API_KEY ??
      process.env.FREEKASSA_APIKEY ??
      process.env.FREEKASSA_CASHBOX_KEY ??
      process.env.FK_API_KEY ??
      "",
  ).trim();
  const secret2 = String(
    process.env.FREEKASSA_SECRET_WORD_2 ??
      process.env.FREEKASSA_SECRET2 ??
      process.env.FREEKASSA_SECRET_WORD_2_ALT ??
      process.env.FREEKASSA_PASSWORD_2 ??
      process.env.FREEKASSA_PASSWORD2 ??
      process.env.FK_SECRET_2 ??
      process.env.FK_SECRET2 ??
      "",
  ).trim();
  const publicAppUrl = String(process.env.PUBLIC_APP_URL ?? "").trim();
  return { shopId, secret1, apiKey, secret2, publicAppUrl };
}

function normalizePublicUrl(value: string | undefined | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function resolvePublicAppUrl(req: Request): string {
  const fromEnv =
    normalizePublicUrl(process.env.PUBLIC_APP_URL) ??
    normalizePublicUrl(process.env.APP_PUBLIC_URL) ??
    normalizePublicUrl(process.env.FRONTEND_PUBLIC_URL);
  if (fromEnv) return fromEnv;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.trim()
      ? forwardedProto.split(",")[0]!.trim()
      : "https";
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostRaw =
    typeof forwardedHost === "string" && forwardedHost.trim()
      ? forwardedHost
      : Array.isArray(forwardedHost) && forwardedHost.length > 0
        ? String(forwardedHost[0] ?? "")
        : String(req.headers.host ?? "");
  const host = hostRaw.trim();
  if (!host) return "https://courtgame.site";
  return `${proto}://${host}`;
}

function readTomeConfig() {
  const combinedCredentials = String(
    process.env.TOMEGE_API_CREDENTIALS ??
      process.env.TOMEGE_API_AUTH ??
      process.env.TOMEGE_API_KEY ??
      process.env.TOME_API_CREDENTIALS ??
      process.env.TOME_API_AUTH ??
      process.env.TOME_API_KEY ??
      "",
  ).trim();

  let shopId = String(
    process.env.TOMEGE_SHOP_ID ??
      process.env.TOMEGE_ACCOUNT_ID ??
      process.env.TOMEGE_MERCHANT_ID ??
      process.env.TOME_SHOP_ID ??
      process.env.TOME_ACCOUNT_ID ??
      process.env.TOME_MERCHANT_ID ??
      "",
  ).trim();
  let secretKey = String(
    process.env.TOMEGE_SECRET_KEY ??
      process.env.TOMEGE_SECRET ??
      process.env.TOME_SECRET_KEY ??
      process.env.TOME_SECRET ??
      "",
  ).trim();

  if (combinedCredentials) {
    const separatorIndex = combinedCredentials.indexOf(":");
    if (separatorIndex > 0) {
      if (!shopId) {
        shopId = combinedCredentials.slice(0, separatorIndex).trim();
      }
      if (!secretKey) {
        secretKey = combinedCredentials.slice(separatorIndex + 1).trim();
      }
    } else if (!secretKey) {
      secretKey = combinedCredentials;
    }
  }

  const notificationUrl =
    normalizePublicUrl(process.env.TOMEGE_NOTIFICATION_URL) ??
    normalizePublicUrl(process.env.TOME_NOTIFICATION_URL) ??
    "https://courtgame.site/api/payments/tomege";

  return { shopId, secretKey, notificationUrl };
}

function readPayPalConfig() {
  const clientId = String(
    process.env.PAYPAL_CLIENT_ID ??
      process.env.PAYPAL_API_KEY ??
      process.env.PAYPAL_KEY ??
      "",
  ).trim();
  const clientSecret = String(
    process.env.PAYPAL_CLIENT_SECRET ??
      process.env.PAYPAL_SECRET_KEY ??
      process.env.PAYPAL_SECRET ??
      "",
  ).trim();
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID ?? "").trim();
  const apiBase = String(process.env.PAYPAL_API_BASE ?? "https://api-m.paypal.com").trim();
  return { clientId, clientSecret, webhookId, apiBase };
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

function resolveTomeSettlementMethod(methodId: number): TomeSettlementMethod | null {
  if (TOME_SBP_METHOD_IDS.has(methodId)) return "sbp";
  if (TOME_CARD_METHOD_IDS.has(methodId)) return "card";
  return null;
}

function buildTomeAuthorizationHeader(shopId: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`, "utf8").toString("base64")}`;
}

function buildTomeNotificationSignature(paymentId: string, secretKey: string): string {
  return crypto.createHash("sha256").update(`${paymentId}${secretKey}`, "utf8").digest("hex");
}

function resolvePayPalOrderIdFromWebhook(
  eventType: string,
  resource: Record<string, unknown>,
): string {
  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    return String(resource.id ?? "").trim();
  }

  const supplementaryData =
    resource.supplementary_data &&
    typeof resource.supplementary_data === "object" &&
    !Array.isArray(resource.supplementary_data)
      ? (resource.supplementary_data as Record<string, unknown>)
      : null;
  const relatedIds =
    supplementaryData?.related_ids &&
    typeof supplementaryData.related_ids === "object" &&
    !Array.isArray(supplementaryData.related_ids)
      ? (supplementaryData.related_ids as Record<string, unknown>)
      : null;

  return String(relatedIds?.order_id ?? "").trim();
}

function resolvePayPalCheckoutMode(methodId: number): PayPalCheckoutMode | null {
  if (PAYPAL_ONLY_METHOD_IDS.has(methodId)) return "paypal";
  if (PAYPAL_CARDS_METHOD_IDS.has(methodId)) return "paypal_cards";
  return null;
}

async function fetchPayPalAccessToken(): Promise<{ accessToken: string; apiBase: string } | null> {
  const { clientId, clientSecret, apiBase } = readPayPalConfig();
  if (!clientId || !clientSecret) return null;

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  }).catch(() => null);

  if (!response?.ok) return null;
  const payload: any = await response.json().catch(() => null);
  const accessToken = String(payload?.access_token ?? "").trim();
  if (!accessToken) return null;
  return { accessToken, apiBase };
}

async function verifyPayPalWebhook(req: Request): Promise<boolean> {
  const { webhookId } = readPayPalConfig();
  if (!webhookId) return false;

  const auth = await fetchPayPalAccessToken();
  if (!auth) return false;

  const authAlgo = String(req.headers["paypal-auth-algo"] ?? "").trim();
  const certUrl = String(req.headers["paypal-cert-url"] ?? "").trim();
  const transmissionId = String(req.headers["paypal-transmission-id"] ?? "").trim();
  const transmissionSig = String(req.headers["paypal-transmission-sig"] ?? "").trim();
  const transmissionTime = String(req.headers["paypal-transmission-time"] ?? "").trim();
  const webhookEvent =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false;
  }

  const verifyResponse = await fetch(`${auth.apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  }).catch(() => null);

  if (!verifyResponse?.ok) return false;
  const payload: any = await verifyResponse.json().catch(() => null);
  return String(payload?.verification_status ?? "").trim().toUpperCase() === "SUCCESS";
}

function extractPayPalOrderCompletionState(payload: Record<string, unknown> | null): {
  orderStatus: string;
  captureStatus: string;
} {
  const orderStatus = String(payload?.status ?? "").trim().toUpperCase();
  const purchaseUnits = Array.isArray(payload?.purchase_units)
    ? (payload?.purchase_units as Array<Record<string, unknown>>)
    : [];
  const firstUnit = purchaseUnits[0] ?? null;
  const payments =
    firstUnit?.payments && typeof firstUnit.payments === "object" && !Array.isArray(firstUnit.payments)
      ? (firstUnit.payments as Record<string, unknown>)
      : null;
  const captures = Array.isArray(payments?.captures)
    ? (payments?.captures as Array<Record<string, unknown>>)
    : [];
  const captureStatus = String(captures[0]?.status ?? "").trim().toUpperCase();
  return { orderStatus, captureStatus };
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

  const { shopId, secret1, apiKey } = readFreeKassaConfig();
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

  // Redirect-mode (secret1) is the most stable default for storefront method routing.
  // API-mode stays as fallback when only API key is configured.
  if (secret1) {
    const currency = "RUB";
    const amountForSign = amountRub.toFixed(2);
    const signature = crypto
      .createHash("md5")
      .update(`${shopId}:${amountForSign}:${secret1}:${currency}:${paymentId}`, "utf8")
      .digest("hex");
    const checkout = new URL("https://pay.fk.money/");
    checkout.searchParams.set("m", shopId);
    checkout.searchParams.set("oa", amountForSign);
    checkout.searchParams.set("o", paymentId);
    checkout.searchParams.set("s", signature);
    checkout.searchParams.set("currency", currency);
    checkout.searchParams.set("lang", "ru");
    checkout.searchParams.set("i", String(methodId));
    checkout.searchParams.set("em", user.email);
    checkout.searchParams.set("us_userId", user.id);
    checkout.searchParams.set("us_tier", paidTier);
    checkout.searchParams.set("us_duration", paidDuration);
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

paymentsRouter.post("/payments/tomege/create", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Session is invalid." });
  }

  const { shopId, secretKey, notificationUrl } = readTomeConfig();
  if (!shopId || !secretKey) {
    return res.status(503).json({
      message:
        "Tome.ge is not configured on the server. Set TOMEGE_SHOP_ID and TOMEGE_SECRET_KEY.",
    });
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
  if (regionRaw !== "cis") {
    return res.status(400).json({ message: "Tome.ge is available only for CIS payments." });
  }

  const methodId = Number(req.body?.paymentSystemId);
  if (!Number.isFinite(methodId) || methodId <= 0) {
    return res.status(400).json({ message: "Invalid payment method." });
  }
  if (!CIS_METHOD_IDS.has(methodId)) {
    return res.status(400).json({ message: "Method is not available for CIS payments." });
  }

  const settlementMethod = resolveTomeSettlementMethod(methodId);
  if (!settlementMethod) {
    return res.status(400).json({ message: "Method is not available for Tome.ge." });
  }

  const paidTier = tier as PaidTier;
  const paidDuration = duration as PaidDuration;
  const amountRub = PRICE_MATRIX_RUB[paidTier][paidDuration];
  const publicAppUrl = resolvePublicAppUrl(req);
  const clientIp = resolveClientIp(req) || "127.0.0.1";
  const idempotencyKey = crypto.randomUUID();
  const description = `Подписка CourtGame: ${paidTier}, ${paidDuration}`;

  const tomeRequestPayload = {
    amount: {
      value: amountRub.toFixed(2),
      currency: "RUB",
    },
    customer: {
      settlement_method: settlementMethod,
      ip: clientIp,
    },
    confirmation: {
      type: "redirect",
      return_url: publicAppUrl,
    },
    description,
    metadata: {
      project: "CourtGame",
      user_id: user.id,
      user_email: user.email,
      tier: paidTier,
      duration: paidDuration,
      method_id: String(methodId),
      notification_url: notificationUrl,
    },
  };

  const tomeResponse = await fetch("https://tome.ge/api/v1/payments", {
    method: "POST",
    headers: {
      Authorization: buildTomeAuthorizationHeader(shopId, secretKey),
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(tomeRequestPayload),
  }).catch(() => null);

  if (!tomeResponse) {
    return res.status(502).json({ message: "Failed to connect to Tome.ge." });
  }

  const tomePayload: any = await tomeResponse.json().catch(() => null);
  const checkoutUrl = String(tomePayload?.confirmation?.confirmation_url ?? "").trim();
  const providerPaymentId = String(tomePayload?.id ?? "").trim();

  if (!tomeResponse.ok || !providerPaymentId || !checkoutUrl) {
    const message =
      String(
        tomePayload?.description ??
          tomePayload?.message ??
          tomePayload?.error_description ??
          tomePayload?.error ??
          "",
      ).trim() || "Tome.ge returned an error while creating payment.";
    return res.status(502).json({ message });
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
        fk_location,
        fk_payload,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
      )
    `,
    [
      crypto.randomUUID(),
      "tomege",
      providerPaymentId,
      user.id,
      paidTier,
      paidDuration,
      amountRub,
      "RUB",
      "cis",
      methodId,
      String(tomePayload?.status ?? "pending").trim() || "pending",
      checkoutUrl,
      JSON.stringify(
        safeJsonPayload({
          idempotencyKey,
          request: tomeRequestPayload,
          response: tomePayload,
        }),
      ),
    ],
  );

  return res.status(200).json({
    ok: true,
    paymentId: providerPaymentId,
    checkoutUrl,
  });
});

paymentsRouter.post("/payments/paypal/create", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Session is invalid." });
  }

  const auth = await fetchPayPalAccessToken();
  if (!auth) {
    return res.status(503).json({
      message:
        "PayPal is not configured on the server. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
    });
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
  if (regionRaw !== "europe") {
    return res.status(400).json({ message: "PayPal is available only for Europe payments." });
  }

  const methodId = Number(req.body?.paymentSystemId);
  if (!Number.isFinite(methodId) || methodId <= 0) {
    return res.status(400).json({ message: "Invalid payment method." });
  }
  if (!PAYPAL_METHOD_IDS.has(methodId)) {
    return res.status(400).json({ message: "Method is not available for PayPal payments." });
  }

  const checkoutMode = resolvePayPalCheckoutMode(methodId);
  if (!checkoutMode) {
    return res.status(400).json({ message: "Method is not available for PayPal payments." });
  }

  const paidTier = tier as PaidTier;
  const paidDuration = duration as PaidDuration;
  const amountEur = PRICE_MATRIX_EUR[paidTier][paidDuration];
  const publicAppUrl = resolvePublicAppUrl(req);
  const description = `CourtGame subscription: ${paidTier}, ${paidDuration}`;
  const orderRequestId = crypto.randomUUID();

  const createOrderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `cg-${Date.now()}`,
        custom_id: `${user.id}:${paidTier}:${paidDuration}:${methodId}`,
        description,
        amount: {
          currency_code: "EUR",
          value: amountEur.toFixed(2),
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "CourtGame",
          locale: "en-GB",
          landing_page: checkoutMode === "paypal" ? "LOGIN" : "GUEST_CHECKOUT",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          return_url: `${publicAppUrl}/profile?payment=paypal_return`,
          cancel_url: `${publicAppUrl}/shop?payment=paypal_cancel`,
        },
      },
    },
  };

  const orderResponse = await fetch(`${auth.apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": orderRequestId,
    },
    body: JSON.stringify(createOrderPayload),
  }).catch(() => null);

  if (!orderResponse) {
    return res.status(502).json({ message: "Failed to connect to PayPal." });
  }

  const orderPayload: any = await orderResponse.json().catch(() => null);
  const providerPaymentId = String(orderPayload?.id ?? "").trim();
  const checkoutUrl = String(
    Array.isArray(orderPayload?.links)
      ? (orderPayload.links.find((link: any) => {
          const rel = String(link?.rel ?? "").trim().toLowerCase();
          return rel === "payer-action" || rel === "approve";
        })?.href ?? "")
      : "",
  ).trim();

  if (!orderResponse.ok || !providerPaymentId || !checkoutUrl) {
    const message =
      String(
        orderPayload?.message ??
          orderPayload?.details?.[0]?.description ??
          orderPayload?.error_description ??
          orderPayload?.error ??
          "",
      ).trim() || "PayPal returned an error while creating payment.";
    return res.status(502).json({ message });
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
        fk_location,
        fk_payload,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
      )
    `,
    [
      crypto.randomUUID(),
      "paypal",
      providerPaymentId,
      user.id,
      paidTier,
      paidDuration,
      Math.round(amountEur * 100),
      "EUR",
      "europe",
      methodId,
      String(orderPayload?.status ?? "CREATED").trim().toLowerCase() || "created",
      checkoutUrl,
      JSON.stringify(
        safeJsonPayload({
          requestId: orderRequestId,
          request: createOrderPayload,
          response: orderPayload,
        }),
      ),
    ],
  );

  return res.status(200).json({
    ok: true,
    paymentId: providerPaymentId,
    checkoutUrl,
  });
});

paymentsRouter.get("/payments/paypal/return", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Session is invalid." });
  }

  const orderId = String(req.query?.token ?? "").trim();
  if (!orderId) {
    return res.status(400).json({ message: "PayPal order token is missing." });
  }

  await ensurePaymentTables();
  const paymentResult = await pool.query<{
    user_id: string;
    tier: string;
    duration: string;
    status: string;
  }>(
    `
      SELECT user_id, tier, duration, status
      FROM auth_payment_orders
      WHERE payment_id = $1 AND provider = 'paypal'
      LIMIT 1
    `,
    [orderId],
  );
  if (!paymentResult.rowCount) {
    return res.status(404).json({ message: "Payment not found." });
  }

  const payment = paymentResult.rows[0];
  if (payment.user_id !== user.id) {
    return res.status(403).json({ message: "This PayPal payment belongs to another user." });
  }

  if (payment.status === "paid") {
    return res.status(200).json({ ok: true, status: "paid" });
  }

  const auth = await fetchPayPalAccessToken();
  if (!auth) {
    return res.status(503).json({ message: "PayPal is not configured on the server." });
  }

  const orderResponse = await fetch(`${auth.apiBase}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
  }).catch(() => null);

  if (!orderResponse) {
    return res.status(502).json({ message: "Failed to load PayPal order status." });
  }

  const orderPayload: any = await orderResponse.json().catch(() => null);
  if (!orderResponse.ok) {
    const message =
      String(
        orderPayload?.message ??
          orderPayload?.details?.[0]?.description ??
          orderPayload?.error_description ??
          orderPayload?.error ??
          "",
      ).trim() || "PayPal order status request failed.";
    return res.status(502).json({ message });
  }

  const initialState = extractPayPalOrderCompletionState(orderPayload);
  let finalPayload: Record<string, unknown> | null = orderPayload;
  let finalOrderStatus = initialState.orderStatus;
  let finalCaptureStatus = initialState.captureStatus;

  if (finalOrderStatus === "APPROVED") {
    const captureResponse = await fetch(`${auth.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: "{}",
    }).catch(() => null);

    if (!captureResponse) {
      return res.status(502).json({ message: "Failed to capture PayPal order." });
    }

    const capturePayload: any = await captureResponse.json().catch(() => null);
    if (!captureResponse.ok) {
      const message =
        String(
          capturePayload?.message ??
            capturePayload?.details?.[0]?.description ??
            capturePayload?.error_description ??
            capturePayload?.error ??
            "",
        ).trim() || "PayPal capture failed.";
      return res.status(502).json({ message });
    }

    finalPayload = capturePayload;
    const capturedState = extractPayPalOrderCompletionState(capturePayload);
    finalOrderStatus = capturedState.orderStatus;
    finalCaptureStatus = capturedState.captureStatus;
  }

  if (finalOrderStatus === "COMPLETED" || finalCaptureStatus === "COMPLETED") {
    const subscription = await assignSubscriptionByUserId({
      userId: payment.user_id,
      tier: payment.tier,
      duration: payment.duration,
      source: "system",
    });
    if (!subscription) {
      return res.status(404).json({ message: "User not found." });
    }

    await pool.query(
      `
        UPDATE auth_payment_orders
        SET
          status = 'paid',
          paid_at = COALESCE(paid_at, NOW()),
          fk_payload = $2,
          updated_at = NOW()
        WHERE payment_id = $1
      `,
      [orderId, JSON.stringify(safeJsonPayload(finalPayload))],
    );

    return res.status(200).json({ ok: true, status: "paid" });
  }

  const nextStatus =
    finalCaptureStatus === "PENDING" || finalOrderStatus === "PAYER_ACTION_REQUIRED"
      ? "pending"
      : payment.status;
  await pool.query(
    `
      UPDATE auth_payment_orders
      SET
        status = $2,
        fk_payload = $3,
        updated_at = NOW()
      WHERE payment_id = $1
    `,
    [orderId, nextStatus, JSON.stringify(safeJsonPayload(finalPayload))],
  );

  return res.status(200).json({ ok: true, status: nextStatus });
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

const tomeGeCallbackHandler = async (req: Request, res: Response) => {
  const { secretKey } = readTomeConfig();
  if (!secretKey) {
    return res.status(503).json({ message: "Tome.ge callback is not configured." });
  }

  await ensurePaymentTables();

  const source =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const signatureRaw = String(source.signature ?? "").trim();
  const event = String(source.event ?? "").trim();
  const object =
    source.object && typeof source.object === "object" && !Array.isArray(source.object)
      ? (source.object as Record<string, unknown>)
      : null;

  const paymentId = String(object?.id ?? "").trim();
  if (!paymentId || !object) {
    return res.status(400).json({ message: "Invalid Tome.ge notification payload." });
  }

  const expectedSignature = buildTomeNotificationSignature(paymentId, secretKey);
  if (!signatureRaw || !secureCompare(signatureRaw.toLowerCase(), expectedSignature.toLowerCase())) {
    return res.status(403).json({ message: "Invalid Tome.ge signature." });
  }

  const paymentResult = await pool.query<{
    user_id: string;
    tier: string;
    duration: string;
    status: string;
  }>(
    `
      SELECT user_id, tier, duration, status
      FROM auth_payment_orders
      WHERE payment_id = $1 AND provider = 'tomege'
      LIMIT 1
    `,
    [paymentId],
  );
  if (!paymentResult.rowCount) {
    return res.status(404).json({ message: "Payment not found." });
  }

  const payment = paymentResult.rows[0];
  const paymentStatus = String(object.status ?? "").trim().toLowerCase();
  const isPaidEvent =
    event === "payment.succeeded" ||
    paymentStatus === "succeeded" ||
    object.paid === true;
  const isCanceledEvent = event === "payment.canceled" || paymentStatus === "canceled";

  if (isPaidEvent && payment.status !== "paid") {
    const subscription = await assignSubscriptionByUserId({
      userId: payment.user_id,
      tier: payment.tier,
      duration: payment.duration,
      source: "system",
    });
    if (!subscription) {
      return res.status(404).json({ message: "User not found." });
    }
  }

  const nextStatus = isPaidEvent ? "paid" : isCanceledEvent ? "canceled" : paymentStatus || "pending";
  await pool.query(
    `
      UPDATE auth_payment_orders
      SET
        status = $2,
        paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
        fk_payload = $3,
        updated_at = NOW()
      WHERE payment_id = $1
    `,
    [paymentId, nextStatus, JSON.stringify(safeJsonPayload(source))],
  );

  return res.status(200).json({ ok: true });
};

const payPalCallbackHandler = async (req: Request, res: Response) => {
  const isVerified = await verifyPayPalWebhook(req);
  if (!isVerified) {
    return res.status(403).json({ message: "Invalid PayPal signature." });
  }

  await ensurePaymentTables();

  const source =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const eventType = String(source.event_type ?? "").trim().toUpperCase();
  const resource =
    source.resource && typeof source.resource === "object" && !Array.isArray(source.resource)
      ? (source.resource as Record<string, unknown>)
      : {};
  const orderId = resolvePayPalOrderIdFromWebhook(eventType, resource);

  if (!orderId) {
    return res.status(400).json({ message: "Order id is missing in PayPal webhook." });
  }

  const paymentResult = await pool.query<{
    user_id: string;
    tier: string;
    duration: string;
    status: string;
  }>(
    `
      SELECT user_id, tier, duration, status
      FROM auth_payment_orders
      WHERE payment_id = $1 AND provider = 'paypal'
      LIMIT 1
    `,
    [orderId],
  );
  if (!paymentResult.rowCount) {
    return res.status(404).json({ message: "Payment not found." });
  }

  const payment = paymentResult.rows[0];

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    if (payment.status === "paid" || payment.status === "capturing" || payment.status === "pending" || payment.status === "canceled") {
      return res.status(200).json({ ok: true });
    }

    await pool.query(
      `
        UPDATE auth_payment_orders
        SET status = 'capturing', fk_payload = $2, updated_at = NOW()
        WHERE payment_id = $1
      `,
      [orderId, JSON.stringify(safeJsonPayload(source))],
    );

    const auth = await fetchPayPalAccessToken();
    if (!auth) {
      return res.status(503).json({ message: "PayPal is not configured on the server." });
    }

    const captureResponse = await fetch(`${auth.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: "{}",
    }).catch(() => null);

    if (!captureResponse) {
      return res.status(502).json({ message: "Failed to capture PayPal order." });
    }

    const capturePayload: any = await captureResponse.json().catch(() => null);
    if (!captureResponse.ok) {
      const message =
        String(
          capturePayload?.message ??
            capturePayload?.details?.[0]?.description ??
            capturePayload?.error_description ??
            capturePayload?.error ??
            "",
        ).trim() || "PayPal capture failed.";
      return res.status(502).json({ message });
    }

    await pool.query(
      `
        UPDATE auth_payment_orders
        SET fk_payload = $2, updated_at = NOW()
        WHERE payment_id = $1
      `,
      [
        orderId,
        JSON.stringify(
          safeJsonPayload({
            webhook: source,
            capture: capturePayload,
          }),
        ),
      ],
    );

    return res.status(200).json({ ok: true });
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    if (payment.status !== "paid") {
      const subscription = await assignSubscriptionByUserId({
        userId: payment.user_id,
        tier: payment.tier,
        duration: payment.duration,
        source: "system",
      });
      if (!subscription) {
        return res.status(404).json({ message: "User not found." });
      }
    }

    await pool.query(
      `
        UPDATE auth_payment_orders
        SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), fk_payload = $2, updated_at = NOW()
        WHERE payment_id = $1
      `,
      [orderId, JSON.stringify(safeJsonPayload(source))],
    );

    return res.status(200).json({ ok: true });
  }

  if (eventType === "PAYMENT.CAPTURE.PENDING") {
    await pool.query(
      `
        UPDATE auth_payment_orders
        SET status = 'pending', fk_payload = $2, updated_at = NOW()
        WHERE payment_id = $1
      `,
      [orderId, JSON.stringify(safeJsonPayload(source))],
    );
    return res.status(200).json({ ok: true });
  }

  if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
    await pool.query(
      `
        UPDATE auth_payment_orders
        SET status = 'canceled', fk_payload = $2, updated_at = NOW()
        WHERE payment_id = $1
      `,
      [orderId, JSON.stringify(safeJsonPayload(source))],
    );
    return res.status(200).json({ ok: true });
  }

  await pool.query(
    `
      UPDATE auth_payment_orders
      SET fk_payload = $2, updated_at = NOW()
      WHERE payment_id = $1
    `,
    [orderId, JSON.stringify(safeJsonPayload(source))],
  );

  return res.status(200).json({ ok: true });
};

paymentsRouter.all("/payments/freekassa", freeKassaCallbackHandler);
paymentsRouter.all("/payments/freekassa/", freeKassaCallbackHandler);
paymentsRouter.all("/payments/freekassa/notify", freeKassaCallbackHandler);
paymentsRouter.all("/payments/tomege", tomeGeCallbackHandler);
paymentsRouter.all("/payments/tomege/", tomeGeCallbackHandler);
paymentsRouter.all("/payments/tomege/notify", tomeGeCallbackHandler);
paymentsRouter.all("/payments/paypal", payPalCallbackHandler);
paymentsRouter.all("/payments/paypal/", payPalCallbackHandler);
paymentsRouter.all("/payments/paypal/notify", payPalCallbackHandler);

export default paymentsRouter;
