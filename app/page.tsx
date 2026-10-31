import { isDatabaseConfigured } from "@/lib/db";
import { isPinConfigured } from "@/lib/auth";
import { Calculator } from "./Calculator";

export default function Home() {
  return <Calculator historyEnabled={isDatabaseConfigured() && isPinConfigured()} />;
}
