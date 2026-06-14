import { createFileRoute } from "@tanstack/react-router";
import { getDataStore } from "../../lib/server/dataStore";
import { getModule } from "../../lib/modules";

export const Route = createFileRoute("/api/records/$module")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const module = getModule(params.module);
        const store = await getDataStore();
        return Response.json(await store.list(module.id));
      },
      POST: async ({ request, params }) => {
        const module = getModule(params.module);
        const payload = (await request.json()) as Record<string, unknown>;
        const store = await getDataStore();
        return Response.json(await store.create(module.id, payload), { status: 201 });
      },
    },
  },
});
