import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";
import { getModule } from "../../lib/modules";
import { readStoreConfig } from "../../lib/server/requestConfig";

export const Route = createFileRoute("/api/records/$module/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const module = getModule(params.module);
          const payload = (await request.json()) as Record<string, unknown>;
          const store = await getDataStore(readStoreConfig(request));
          return Response.json(await store.update(module.id, params.id, payload));
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Failed to update record" }, { status: 500 });
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const module = getModule(params.module);
          const store = await getDataStore(readStoreConfig(request));
          await store.remove(module.id, params.id);
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Failed to delete record" }, { status: 500 });
        }
      },
    },
  },
});
