import { createFileRoute } from "@tanstack/react-router";
import { uploadToBucket } from "../../lib/server/bucket";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }
        return Response.json(await uploadToBucket(file), { status: 201 });
      },
    },
  },
});
