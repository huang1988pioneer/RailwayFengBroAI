import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const store = await getDataStore();
        return Response.json({ ok: true, ...(await store.health()) });
      },
    },
  },
});
