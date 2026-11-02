"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Pay stub links carry an employee's name and a signed token in the query string
// (/stub?w=…&n=…&t=…), so drop every query string before a page view leaves the device.
function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

export function WebAnalytics() {
  return <Analytics beforeSend={stripQuery} />;
}
