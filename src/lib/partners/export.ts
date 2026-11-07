import { sql } from "drizzle-orm";
import { database } from "./store";

/** Stream the complete statement from one repeatable-read database snapshot. */
export function financialReport(partnerId: string) {
  const encoder = new TextEncoder();
  let canceled = false;
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""')}"`;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await database().transaction(async (tx) => {
          await tx.execute(sql`set transaction isolation level repeatable read read only`);
          controller.enqueue(
            encoder.encode(
              [
                "commission",
                "payment",
                "currency",
                "rate_bps",
                "earned_minor",
                "adjusted_minor",
                "settled_minor",
                "due_minor",
                "state",
                "earned_at",
              ]
                .map(cell)
                .join(",") + "\r\n",
            ),
          );
          for (let offset = 0; !canceled; offset += 500) {
            const result =
              await tx.execute(sql`select c.id,c."paymentId",c.currency,c."rateBps",c."amountMinor",c.state,c."earnedAt",
              coalesce((select sum(a."commissionDeltaMinor") from "PartnerAdjustment" a where a."paymentId"=c."paymentId"),0)::text as adjusted,
              coalesce((select sum(i."amountMinor") from "PartnerPayoutItem" i where i."commissionId"=c.id),0)::text as settled
              from "PartnerCommission" c where c."partnerId"=${partnerId} order by c.id limit 500 offset ${offset}`);
            for (const c of result.rows) {
              const due =
                BigInt(String(c.amountMinor)) -
                BigInt(String(c.adjusted)) -
                BigInt(String(c.settled));
              controller.enqueue(
                encoder.encode(
                  [
                    c.id,
                    c.paymentId,
                    c.currency,
                    c.rateBps,
                    c.amountMinor,
                    c.adjusted,
                    c.settled,
                    due,
                    c.state,
                    new Date(String(c.earnedAt)).toISOString(),
                  ]
                    .map(cell)
                    .join(",") + "\r\n",
                ),
              );
            }
            if (result.rows.length < 500) break;
          }
        });
        if (!canceled) controller.close();
      } catch {
        if (!canceled) controller.error(new Error("Financial report generation failed."));
      }
    },
    cancel() {
      canceled = true;
    },
  });
}
