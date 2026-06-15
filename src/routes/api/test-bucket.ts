import { createFileRoute } from "@tanstack/react-router";
import { testConnectionTarget } from "../../../lib/connectionTester.js";

export const Route = createFileRoute("/api/test-bucket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        try {
          const body = await request.json().catch(() => ({}));
          const details = await testConnectionTarget({ ...body, target: "bucket" });
          return Response.json({
            ok: true,
            latencyMs: Date.now() - started,
            checkedAt: new Date().toISOString(),
            details,
          });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              latencyMs: Date.now() - started,
              checkedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "Bucket test failed.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
