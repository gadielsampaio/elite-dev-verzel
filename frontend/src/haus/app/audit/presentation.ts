import type { AuditResult } from "@/types/audit";

export function auditExplanation(
  data: AuditResult | null,
  status: string,
  ready: boolean,
  valid?: boolean | null,
) {
  if (data?.status !== "intact" || status === "INTACT") return data?.reason;
  if (!ready) return "Checking hashes in your browser…";
  if (valid === null) return "Browser verification is unavailable. Use HTTPS or localhost.";
  return "The browser could not match the chain to the audit checkpoint.";
}
