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
        try {
          const result = await uploadToBucket(file, {
            module: String(formData.get("module") || ""),
            field: String(formData.get("field") || ""),
            requireBucket: String(formData.get("requireBucket") || "") === "true",
          });
          return Response.json(result, { status: 201 });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
