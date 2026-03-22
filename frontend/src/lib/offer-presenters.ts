import type { ApiPaymentType, CounterOfferDto, OfferDto } from "@/api/types";

type PaymentTermsLike = Pick<OfferDto, "payment_type" | "price_amount" | "barter_description" | "message">
  | Pick<CounterOfferDto, "payment_type" | "price_amount" | "barter_description" | "message">;

function getLeadSegment(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .split(" · ")
    .map((part) => part.trim())
    .find(Boolean) ?? null;
}

export function isBarterLikePayment(
  paymentType: ApiPaymentType,
  taskPaymentType?: ApiPaymentType | null,
): boolean {
  return paymentType === "barter" || (paymentType === "negotiable" && taskPaymentType === "barter");
}

export function getExchangeDescription(
  terms: PaymentTermsLike,
  taskPaymentType?: ApiPaymentType | null,
): string | null {
  if (terms.payment_type === "barter") {
    return terms.barter_description?.trim() || terms.message?.trim() || null;
  }

  if (terms.payment_type === "negotiable" && taskPaymentType === "barter") {
    return terms.message?.trim() || null;
  }

  return null;
}

export function getOfferHeadline(
  terms: PaymentTermsLike,
  taskPaymentType?: ApiPaymentType | null,
): string | null {
  const barterLikeDescription = getExchangeDescription(terms, taskPaymentType);

  if (barterLikeDescription) {
    return getLeadSegment(barterLikeDescription);
  }

  if (terms.payment_type === "negotiable") {
    return getLeadSegment(terms.message);
  }

  return null;
}

export function getOfferBadgeLabel(
  terms: PaymentTermsLike,
  taskPaymentType?: ApiPaymentType | null,
): string {
  if (terms.payment_type === "fixed_price") {
    return typeof terms.price_amount === "number" ? `${terms.price_amount} ₽` : "Цена уточняется";
  }

  if (isBarterLikePayment(terms.payment_type, taskPaymentType)) {
    return getOfferHeadline(terms, taskPaymentType) ?? "Бартер";
  }

  return getOfferHeadline(terms, taskPaymentType) ?? "Услуга";
}

export function getOfferTypeLabel(
  paymentType: ApiPaymentType,
  taskPaymentType?: ApiPaymentType | null,
): string {
  if (paymentType === "fixed_price") {
    return "Фиксированная стоимость";
  }

  if (isBarterLikePayment(paymentType, taskPaymentType)) {
    return "Обмен или взаимная услуга";
  }

  return "Услуга";
}

export function getOfferSummaryTitle(
  paymentType: ApiPaymentType,
  taskPaymentType?: ApiPaymentType | null,
): string {
  if (paymentType === "fixed_price") {
    return "Условия";
  }

  if (isBarterLikePayment(paymentType, taskPaymentType)) {
    return "Что взамен";
  }

  return "Услуга";
}

export function formatPaymentValue(
  paymentType: ApiPaymentType,
  priceAmount: number | null,
): string {
  if (paymentType === "fixed_price") {
    return typeof priceAmount === "number" ? `${priceAmount} ₽` : "Цена уточняется";
  }

  if (paymentType === "barter") {
    return "Без денежной оплаты";
  }

  return "По договорённости";
}
