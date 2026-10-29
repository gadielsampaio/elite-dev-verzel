import { api } from "./client";

export function cancelLot(lotId: string, token: string) {
  return api(`/lots/${lotId}/cancel`, token, { method: "PATCH", body: "{}" });
}
