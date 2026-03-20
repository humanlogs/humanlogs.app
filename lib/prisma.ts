import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { databaseConfig } from "./config";
import { emitDatabaseChange } from "./socket-server";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseConfig.url,
  }),
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

// Extend Prisma with middleware for socket events
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);

        // Only emit events for specific models and operations
        const trackedModels = ["Transcription", "Project", "User"];
        const trackedActions = ["create", "update", "delete", "updateMany"];

        if (
          model &&
          trackedModels.includes(model) &&
          trackedActions.includes(operation)
        ) {
          try {
            // Extract userId from the result or query
            let userId: string | null = null;
            let recordId: string | undefined;

            // Use type assertions with safe checks
            const resultObj = result as Record<string, unknown> | null | undefined;
            const argsObj = args as Record<string, unknown> | null | undefined;

            if (model === "User" && resultObj && "id" in resultObj) {
              userId = String(resultObj.id);
              recordId = String(resultObj.id);
            } else if (resultObj && "userId" in resultObj) {
              userId = String(resultObj.userId);
              if ("id" in resultObj) {
                recordId = String(resultObj.id);
              }
            } else if (argsObj && "where" in argsObj) {
              const where = argsObj.where as Record<string, unknown>;
              if (where && "userId" in where) {
                userId = String(where.userId);
              }
            } else if (argsObj && "data" in argsObj) {
              const data = argsObj.data as Record<string, unknown>;
              if (data && "userId" in data) {
                userId = String(data.userId);
              }
            }

            if (userId) {
              const op =
                operation === "updateMany" ? "update" : operation;
              emitDatabaseChange(
                userId,
                model.toLowerCase(),
                op as "create" | "update" | "delete",
                { id: recordId },
              );
            }
          } catch (error) {
            console.error("Error emitting socket event:", error);
          }
        }

        return result;
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
