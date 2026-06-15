import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";
import { readStoreConfig } from "../../lib/server/requestConfig";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const store = await getDataStore(readStoreConfig(request));
          return Response.json({ ok: true, ...(await store.health()) });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Database health check failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
