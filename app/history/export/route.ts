import { isDatabaseConfigured } from "@/lib/db";
import { isManager } from "@/lib/auth";
import { isRangeKey, loadHistory } from "@/lib/history";
import { csvFileName, shiftsToCsv } from "@/lib/csv";

export async function GET(request: Request) {
  if (!isDatabaseConfigured() || !(await isManager())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const param = params.get("range");
  const range = isRangeKey(param) ? param : "payday";
  const { shifts, from, to } = await loadHistory(range, params.get("week") ?? undefined);

  return new Response(shiftsToCsv(shifts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(from, to)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
