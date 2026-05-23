import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

// All subscription routes require authentication
router.use(authenticate);

// ─── GET /api/subscription ────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    let subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.userId },
    });

    // Auto-create a free subscription if none exists
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: req.user!.userId,
          plan: "free",
          status: "active",
        },
      });
    }

    res.json({ subscription });
  } catch (error) {
    console.error("[GET SUBSCRIPTION ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/subscription/create-checkout-session ───────────────────────────
// Stripe-ready placeholder: creates a mock checkout session
// In production, this would create a Stripe Checkout Session

router.post("/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const { plan } = req.body;

    if (!plan || !["pro", "enterprise"].includes(plan)) {
      res.status(400).json({ message: "Invalid plan. Must be 'pro' or 'enterprise'" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // ─── STRIPE INTEGRATION POINT ─────────────────────────────────────
    // In production, replace this with:
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const session = await stripe.checkout.sessions.create({
    //   customer_email: user.email,
    //   mode: "subscription",
    //   line_items: [{ price: process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`], quantity: 1 }],
    //   success_url: `${process.env.CLIENT_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${process.env.CLIENT_URL}/pricing`,
    //   metadata: { userId: user.id },
    // });
    // ───────────────────────────────────────────────────────────────────

    // Placeholder: return a mock session URL
    const mockSessionUrl = `/mock-checkout?plan=${plan}&userId=${user.id}`;

    res.json({
      message: `Checkout session created for ${plan} plan`,
      url: mockSessionUrl,
      // In production: session.url
    });
  } catch (error) {
    console.error("[CREATE CHECKOUT SESSION ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/subscription/portal-session ────────────────────────────────────
// Stripe-ready placeholder: creates a customer portal session for managing billing

router.post("/portal-session", async (_req: Request, res: Response): Promise<void> => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: _req.user!.userId },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      res.status(400).json({ message: "No active subscription with Stripe customer ID" });
      return;
    }

    // ─── STRIPE INTEGRATION POINT ─────────────────────────────────────
    // In production, replace this with:
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const session = await stripe.billingPortal.sessions.create({
    //   customer: subscription.stripeCustomerId,
    //   return_url: `${process.env.CLIENT_URL}/dashboard`,
    // });
    // ───────────────────────────────────────────────────────────────────

    res.json({
      message: "Billing portal session created",
      url: "/mock-billing-portal",
      // In production: session.url
    });
  } catch (error) {
    console.error("[PORTAL SESSION ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/subscription/cancel ────────────────────────────────────────────

router.post("/cancel", async (req: Request, res: Response): Promise<void> => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!subscription) {
      res.status(404).json({ message: "No subscription found" });
      return;
    }

    if (subscription.plan === "free") {
      res.status(400).json({ message: "Cannot cancel a free plan" });
      return;
    }

    // ─── STRIPE INTEGRATION POINT ─────────────────────────────────────
    // In production, cancel at Stripe first:
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // await stripe.subscriptions.cancel(subscription.stripeSubscriptionId!);
    // ───────────────────────────────────────────────────────────────────

    await prisma.subscription.update({
      where: { userId: req.user!.userId },
      data: {
        plan: "free",
        status: "active",
        stripeSubscriptionId: null,
        canceledAt: new Date(),
      },
    });

    res.json({ message: "Subscription canceled. You are now on the free plan." });
  } catch (error) {
    console.error("[CANCEL SUBSCRIPTION ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/subscription/webhook ───────────────────────────────────────────
// Stripe-ready placeholder: handles Stripe webhook events

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    // ─── STRIPE INTEGRATION POINT ─────────────────────────────────────
    // In production, verify the webhook signature:
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const sig = req.headers["stripe-signature"] as string;
    // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    //
    // switch (event.type) {
    //   case "checkout.session.completed": { ... }
    //   case "invoice.paid": { ... }
    //   case "customer.subscription.updated": { ... }
    //   case "customer.subscription.deleted": { ... }
    // }
    // ───────────────────────────────────────────────────────────────────

    const event = req.body;

    console.log("[STRIPE WEBHOOK RECEIVED]", event.type || "unknown");

    res.json({ received: true });
  } catch (error) {
    console.error("[WEBHOOK ERROR]", error);
    res.status(400).json({ message: "Webhook error" });
  }
});

export default router;
