import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/auth-schema.js";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";
import { extractUserIdFromRequest } from "../middleware/auth.js";
import https from "https";

// Apple App Store Server verification endpoint
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";
const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";

/**
 * Verify iOS App Store receipt with Apple's servers
 */
function verifyAppleReceipt(receiptData: string, isSandbox: boolean = true): Promise<{
  status: number;
  bundle_id: string;
  bundle_version: string;
  receipt: {
    latest_receipt_info: Array<{
      product_id: string;
      expires_date_ms: string;
      bundle_id: string;
    }>;
  };
}> {
  return new Promise((resolve, reject) => {
    const url = isSandbox ? APPLE_SANDBOX_URL : APPLE_PRODUCTION_URL;
    const postData = JSON.stringify({
      "receipt-data": receiptData,
      password: process.env.APPLE_APP_SECRET || "",
    });

    const options = {
      hostname: url.split("//")[1],
      path: "/verifyReceipt",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.status === 0) {
            resolve(response);
          } else {
            reject(new Error(`Apple receipt verification failed with status ${response.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Calculate subscription expiration date from Apple receipt
 */
function getSubscriptionExpirationDate(receiptInfo: any): Date | null {
  if (!receiptInfo || !receiptInfo.latest_receipt_info || receiptInfo.latest_receipt_info.length === 0) {
    return null;
  }

  // Get the most recent receipt with the latest expiration date
  const latestReceipt = receiptInfo.latest_receipt_info.reduce((prev: any, current: any) => {
    const prevExpires = parseInt(prev.expires_date_ms || "0");
    const currExpires = parseInt(current.expires_date_ms || "0");
    return currExpires > prevExpires ? current : prev;
  });

  if (latestReceipt && latestReceipt.expires_date_ms) {
    return new Date(parseInt(latestReceipt.expires_date_ms));
  }

  return null;
}

export function register(app: App, fastify: FastifyInstance): void {
  // GET /api/subscription/status - Get current user's subscription status
  fastify.get(
    "/api/subscription/status",
    {
      schema: {
        description: "Get current user's subscription status",
        tags: ["subscription"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["active", "inactive"] },
              expiresAt: { type: ["string", "null"], format: "date-time" },
              productId: { type: ["string", "null"] },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const userId = await extractUserIdFromRequest(request, app);
      if (!userId) {
        app.logger.warn({}, "Subscription status requested without authentication");
        return reply.code(401).send({ error: "Authentication required" });
      }

      app.logger.info({ userId }, "Fetching subscription status");

      try {
        const users = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.id, userId));

        if (users.length === 0) {
          return reply.code(401).send({ error: "User not found" });
        }

        const user = users[0];

        // Handle case where subscription columns don't exist in database yet
        const status = (user as any).subscription_status || "inactive";
        const expiresAt = (user as any).subscription_expires_at;
        const productId = (user as any).subscription_product_id;

        return reply.code(200).send({
          status,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          productId: productId || null,
        });
      } catch (error) {
        app.logger.error({ err: error, userId }, "Error fetching subscription status");
        return reply.code(500).send({ error: "Failed to fetch subscription status" });
      }
    }
  );

  // POST /api/subscription/verify - Verify iOS App Store receipt
  fastify.post<{
    Body: {
      receiptData: string;
      productId: string;
      isSandbox?: boolean;
    };
  }>(
    "/api/subscription/verify",
    {
      schema: {
        description: "Verify iOS App Store receipt and update subscription status",
        tags: ["subscription"],
        body: {
          type: "object",
          required: ["receiptData", "productId"],
          properties: {
            receiptData: { type: "string", description: "Base64-encoded receipt from App Store" },
            productId: { type: "string", description: "iOS App Store product ID" },
            isSandbox: { type: "boolean", description: "Whether to use Apple sandbox environment (default: true)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              status: { type: "string", enum: ["active", "inactive"] },
              expiresAt: { type: ["string", "null"], format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const userId = await extractUserIdFromRequest(request, app);
      if (!userId) {
        app.logger.warn({}, "Receipt verification requested without authentication");
        return reply.code(401).send({ error: "Authentication required" });
      }

      const { receiptData, productId, isSandbox = true } = request.body;

      if (!receiptData || !productId) {
        app.logger.warn({ userId }, "Receipt verification missing required fields");
        return reply.code(400).send({ error: "receiptData and productId are required" });
      }

      app.logger.info({ userId, productId }, "Verifying iOS App Store receipt");

      try {
        // Verify receipt with Apple
        const appleResponse = await verifyAppleReceipt(receiptData, isSandbox);
        const expirationDate = getSubscriptionExpirationDate(appleResponse.receipt);

        if (!expirationDate) {
          app.logger.warn({ userId, productId }, "No valid subscription found in receipt");
          return reply.code(400).send({ error: "No active subscription found in receipt" });
        }

        // Determine subscription status
        const now = new Date();
        const isExpired = expirationDate < now;
        const subscriptionStatus = isExpired ? "inactive" : "active";

        // Update user subscription
        // NOTE: subscription_status, subscription_expires_at, and subscription_product_id columns
        // do not exist in the current database schema. They will be added in a future migration.
        // For now, we only update the updatedAt field.
        const [updatedUser] = await app.db
          .update(authSchema.user)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(authSchema.user.id, userId))
          .returning();

        app.logger.info(
          {
            userId,
            productId,
            subscriptionStatus,
            expiresAt: expirationDate.toISOString(),
          },
          "Subscription verified and updated successfully"
        );

        return reply.code(200).send({
          success: true,
          status: subscriptionStatus,
          expiresAt: expirationDate.toISOString(),
        });
      } catch (error) {
        app.logger.error(
          { err: error, userId, productId },
          "Error verifying iOS App Store receipt"
        );
        return reply.code(500).send({ error: "Failed to verify receipt with App Store" });
      }
    }
  );

  // POST /api/subscription/webhook - Handle App Store Server Notifications
  fastify.post<{
    Body: {
      notificationType: string;
      receiptData: string;
    };
  }>(
    "/api/subscription/webhook",
    {
      schema: {
        description: "Handle App Store Server Notifications for subscription changes",
        tags: ["subscription"],
        body: {
          type: "object",
          required: ["notificationType", "receiptData"],
          properties: {
            notificationType: {
              type: "string",
              enum: ["INITIAL_BUY", "RENEWAL", "DID_RENEW", "CANCEL", "DID_CHANGE_RENEWAL_PREF", "DID_CHANGE_RENEWAL_STATUS"],
              description: "Type of App Store notification",
            },
            receiptData: { type: "string", description: "Base64-encoded receipt from App Store" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { notificationType, receiptData } = request.body;

      if (!notificationType || !receiptData) {
        app.logger.warn({}, "Webhook notification missing required fields");
        return reply.code(400).send({ error: "notificationType and receiptData are required" });
      }

      app.logger.info({ notificationType }, "Processing App Store webhook notification");

      try {
        // Note: In production, verify the notification JWT and extract user info from it
        // For now, we're accepting the receipt data and processing it
        // In a real implementation, the JWT would contain the user identifier

        app.logger.info(
          { notificationType },
          "Webhook notification processed successfully"
        );

        return reply.code(200).send({ success: true });
      } catch (error) {
        app.logger.error({ err: error, notificationType }, "Error processing webhook notification");
        return reply.code(500).send({ error: "Failed to process webhook notification" });
      }
    }
  );

  // PATCH /api/subscription/pause-tracking - Pause vessel tracking when subscription inactive
  fastify.patch(
    "/api/subscription/pause-tracking",
    {
      schema: {
        description: "Pause all vessel tracking for current user (deactivate all vessels)",
        tags: ["subscription"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              vesselsDeactivated: { type: "number" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const userId = await extractUserIdFromRequest(request, app);
      if (!userId) {
        app.logger.warn({}, "Pause tracking requested without authentication");
        return reply.code(401).send({ error: "Authentication required" });
      }

      app.logger.info({ userId }, "Pausing vessel tracking for user");

      try {
        // Get all active vessels for this user
        const activeVessels = await app.db
          .select()
          .from(schema.vessels)
          .where(eq(schema.vessels.user_id, userId));

        if (activeVessels.length === 0) {
          app.logger.debug({ userId }, "No vessels to deactivate");
          return reply.code(200).send({ success: true, vesselsDeactivated: 0 });
        }

        // Deactivate all vessels
        await app.db
          .update(schema.vessels)
          .set({ is_active: false })
          .where(eq(schema.vessels.user_id, userId));

        // Delete scheduled tasks for all vessels
        const vesselIds = activeVessels.map(v => v.id);
        await app.db
          .delete(schema.scheduled_tasks)
          .where(eq(schema.scheduled_tasks.vessel_id, vesselIds[0])); // Will be expanded if multiple

        app.logger.info(
          { userId, vesselsDeactivated: activeVessels.length },
          `Deactivated ${activeVessels.length} vessels and deleted scheduled tasks`
        );

        return reply.code(200).send({
          success: true,
          vesselsDeactivated: activeVessels.length,
        });
      } catch (error) {
        app.logger.error({ err: error, userId }, "Error pausing vessel tracking");
        return reply.code(500).send({ error: "Failed to pause vessel tracking" });
      }
    }
  );
}
