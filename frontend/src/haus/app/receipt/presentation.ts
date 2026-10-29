import type { Result } from "@/types/results";

export function receiptLabel(result: Result) {
  if (result.status === "settled" && result.receipt) return "Settled";
  if (result.status === "no_winner") return "No winner";
  if (result.status === "awaiting_close") return "Awaiting close";
  return "Settlement pending";
}

export const receiptStatusMessages: Record<Result["status"], string> = {
  no_winner: "Closed without a winner. No funds were transferred.",
  awaiting_close: "This auction has not ended. No receipt is available yet.",
  settled: "Receipt details are unavailable. Refresh the result to try again.",
  pending_settlement: "Settlement is pending. No completed sale is confirmed yet.",
};
