import { recordsApi } from "../server/records-api.ts";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/records/"))
      return recordsApi(request, env.DB);
    if (url.pathname === "/api/expenses/status")
      return Response.json(
        { configured: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (url.pathname.startsWith("/api/"))
      return Response.json({ error: "OpenClaw 尚未設定" }, { status: 503 });
    return env.ASSETS.fetch(request);
  },
};
