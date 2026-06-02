# Payment Provider Research Brief

## Market Context

Small business SaaS platforms often support more than one payment provider to reduce checkout
friction and support buyer preference. Stripe fits card-first SaaS checkout, subscription webhooks,
and developer-managed billing flows. PayPal adds familiar wallet checkout and buyer trust for
customers who prefer a PayPal account over entering card details.

| Provider | Key Strength                                              | Integration Cost               |
| -------- | --------------------------------------------------------- | ------------------------------ |
| Stripe   | Developer experience, webhooks, recurring billing         | Low for current stack          |
| PayPal   | Wallet trust, buyer familiarity, PayPal Business accounts | Medium for a second provider   |
| Both     | User choice and checkout fallback                         | Higher due to dual maintenance |

## Customer Impact

- Checkout choice gives users a fallback when card entry, bank rules, or local payment preference blocks conversion.
- PayPal Business accounts fit some owner-operated businesses that already use PayPal for vendor payments.
- Stripe remains the primary provider for subscription automation, proration, card wallets, and hosted billing portal workflows.

## Practical Data

### Subscription Management Comparison

| Feature            | Stripe                               | PayPal                                 |
| ------------------ | ------------------------------------ | -------------------------------------- |
| Recurring billing  | Native via Subscriptions             | Native via Subscriptions (v2)          |
| Webhooks           | Event-driven with retries            | Event-driven with reconciliation needs |
| Proration          | Full support                         | Limited support                        |
| Trial periods      | Native                               | Manual implementation                  |
| Invoice management | Customer Portal                      | Billing Agreements + notifications     |
| Refund handling    | API-driven                           | API + dispute center                   |
| Churn indicators   | Subscription status, payment intents | Subscription status, agreement state   |

### Implementation Complexity

- Stripe is the current payment provider.
- PayPal needs checkout session creation, webhook verification, billing agreement management, customer status mapping, and admin replay parity.
- The billing model needs provider-specific customer and subscription IDs plus a normalized subscription event shape.

## Risk Factors

- **Webhook duplication**: Both Stripe and PayPal send overlapping subscription events. Billing reconciliation treats the active provider as the source of truth.
- **Simultaneous subscriptions**: A user can subscribe through more than one provider unless the checkout flow blocks a second active subscription.
- **Payment method switch**: Switching providers on the next billing cycle requires coordinated cancellation and new subscription creation.
- **Admin operations**: Superadmin replay endpoints, customer status overrides, and discount application must work identically for both providers.

## Recommended Architecture

```
User checkout → Provider selection (Stripe / PayPal)
             → Create checkout session (respective SDK)
             → User completes on provider domain
             → Webhook handler (respective) → Normalised subscription event
             → Update profiles table → Grant/revoke plan access
```

Normalised subscription event shape:

```
{
  provider: "stripe" | "paypal",
  eventType: "created" | "updated" | "cancelled" | "refunded",
  customerId: string,
  subscriptionId: string,
  status: "active" | "past_due" | "cancelled" | "expired",
  priceId: string | null,
  currentPeriodEnd: Date | null
}
```

## Future Considerations

- Add Apple Pay and Google Pay through Stripe Elements when card-wallet checkout becomes a priority.
- Add bank transfer or SEPA when EU business customers request lower-friction bank payments.
- Add invoicing for B2B customers when sales needs purchase orders, payment terms, and manual invoice approval.

## Source Review

- Verify PayPal market preference, checkout conversion, and regional payment behavior from current provider docs or payment-industry reports before using numbers in a sales presentation.
- Keep sourced numbers out of customer-facing material until the source, publication date, and methodology are recorded.
