import "server-only";
import { db } from "./db";
import type { WebhookDb } from "./stripe-webhook";

/**
 * Connects the webhook logic to the real Prisma client. Each method forwards explicitly
 * (no casts), so if WebhookTx's argument types drift from Prisma's, typecheck fails.
 */
export const webhookDb: WebhookDb = {
  $transaction: (fn) =>
    db.$transaction((tx) =>
      fn({
        stripeEvent: { createMany: (args) => tx.stripeEvent.createMany(args) },
        donation: {
          updateMany: (args) => tx.donation.updateMany(args),
          findUnique: (args) => tx.donation.findUnique(args),
        },
      }),
    ),
};
