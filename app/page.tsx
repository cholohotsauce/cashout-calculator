import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isPinConfigured } from "@/lib/auth";
import { calculatorConfig } from "@/lib/staff";
import { Calculator } from "./Calculator";

export default async function Home() {
  // The roster and kitchen share are live settings, so read them on every visit.
  await connection();
  const { staff, bohShare } = await calculatorConfig();
  return <Calculator historyEnabled={isDatabaseConfigured() && isPinConfigured()} roster={staff} bohShare={bohShare} />;
}
