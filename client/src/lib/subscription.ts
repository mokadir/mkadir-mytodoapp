import { request } from "./api";

export type Subscription = {
  id: string;
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionResponse = { subscription: Subscription };
type CheckoutResponse = { message: string; url: string };
type MessageResponse = { message: string };

export const subscriptionApi = {
  get: () => request<SubscriptionResponse>("/subscription"),

  createCheckoutSession: (plan: string) =>
    request<CheckoutResponse>("/subscription/create-checkout-session", {
      method: "POST",
      body: { plan },
    }),

  createPortalSession: () =>
    request<CheckoutResponse>("/subscription/portal-session", {
      method: "POST",
    }),

  cancel: () =>
    request<MessageResponse>("/subscription/cancel", {
      method: "POST",
    }),
};
