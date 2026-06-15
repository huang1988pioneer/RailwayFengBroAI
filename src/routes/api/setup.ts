import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";
import { readStoreConfig } from "../../lib/server/requestConfig";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const store = await getDataStore(readStoreConfig(request));
          const result = store.setup ? await store.setup() : await store.health();
          return Response.json({ ...result, message: "FengBro storage initialized." });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Storage setup failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
