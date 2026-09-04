import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  getInvoiceSubscriptionId,
  getSubscriptionPeriodEnd,
} from "@/lib/billing/stripe";

/**
 * Stripe's `2025-04-30.basil` release moved two fields this app bills on:
 * `invoice.subscription` sank into `invoice.parent.subscription_details`, and
 * `subscription.current_period_end` moved onto the subscription's items.
 *
 * Reading the old locations does not throw — it just yields `undefined`, which
 * made every subscription invoice look like a one-off and skipped the credit
 * grant that pays for the plan. Webhook payloads are rendered at whatever API
 * version the *endpoint* is pinned to in the dashboard, so both shapes can
 * reach the same deployment and both have to be understood.
 */

describe("getInvoiceSubscriptionId", () => {
  it("reads the Basil-and-later shape", () => {
    const invoice = {
      id: "in_1",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123", metadata: null },
      },
    } as unknown as Stripe.Invoice;

    expect(getInvoiceSubscriptionId(invoice)).toBe("sub_123");
  });

  it("reads an expanded subscription object", () => {
    const invoice = {
      id: "in_1",
      parent: {
        subscription_details: { subscription: { id: "sub_123" } },
      },
    } as unknown as Stripe.Invoice;

    expect(getInvoiceSubscriptionId(invoice)).toBe("sub_123");
  });

  it("still reads the pre-Basil top-level field", () => {
    const invoice = {
      id: "in_1",
      subscription: "sub_legacy",
    } as unknown as Stripe.Invoice;

    expect(getInvoiceSubscriptionId(invoice)).toBe("sub_legacy");
  });

  it("returns null for a genuine one-off invoice", () => {
    const invoice = {
      id: "in_1",
      parent: null,
    } as unknown as Stripe.Invoice;

    expect(getInvoiceSubscriptionId(invoice)).toBeNull();
  });

  it("returns null for a quote-generated invoice", () => {
    const invoice = {
      id: "in_1",
      parent: { type: "quote_details", quote_details: { quote: "qt_1" } },
    } as unknown as Stripe.Invoice;

    expect(getInvoiceSubscriptionId(invoice)).toBeNull();
  });
});

describe("getSubscriptionPeriodEnd", () => {
  it("reads the period from the subscription item", () => {
    const subscription = {
      id: "sub_1",
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as unknown as Stripe.Subscription;

    expect(getSubscriptionPeriodEnd(subscription)).toEqual(
      new Date(1_800_000_000 * 1000),
    );
  });

  it("still reads the pre-Basil top-level field", () => {
    const subscription = {
      id: "sub_1",
      items: { data: [{}] },
      current_period_end: 1_700_000_000,
    } as unknown as Stripe.Subscription;

    expect(getSubscriptionPeriodEnd(subscription)).toEqual(
      new Date(1_700_000_000 * 1000),
    );
  });

  it("returns null rather than an Invalid Date when neither is present", () => {
    const subscription = {
      id: "sub_1",
      items: { data: [] },
    } as unknown as Stripe.Subscription;

    expect(getSubscriptionPeriodEnd(subscription)).toBeNull();
  });
});
