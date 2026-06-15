import { createFileRoute } from "@tanstack/react-router";
import { readBucketFile } from "../../lib/server/bucket";

export const Route = createFileRoute("/api/files/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = decodeURIComponent(params.key);
        const file = await readBucketFile(key);
        return new Response(file.bytes, {
          headers: {
            "Content-Type": file.type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
