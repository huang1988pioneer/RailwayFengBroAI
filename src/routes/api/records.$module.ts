import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";
import { getModule } from "../../lib/modules";
import { readStoreConfig } from "../../lib/server/requestConfig";

export const Route = createFileRoute("/api/records/$module")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const module = getModule(params.module);
          const store = await getDataStore(readStoreConfig(request));
          return Response.json(await store.list(module.id));
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Failed to list records" }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const module = getModule(params.module);
          const payload = (await request.json()) as Record<string, unknown>;
          const store = await getDataStore(readStoreConfig(request));
          return Response.json(await store.create(module.id, payload), { status: 201 });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Failed to create record" }, { status: 500 });
        }
      },
    },
  },
});
