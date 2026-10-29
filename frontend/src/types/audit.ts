export type AuditEntry = {
  lotId: string;
  sequence: number;
  previousHash: string | null;
  bidId: string;
  bidderAlias: string;
  amount: string;
  currency: string;
  acceptedAt: string;
  endTime: string;
  hash: string;
};

export type AuditResult = {
  lotId: string;
  title: string;
  status: "intact" | "tampered" | "not_verifiable";
  reason: string;
  checkedAt: string;
  entries: AuditEntry[];
  checkpoint: { sequence: number; hash: string } | null;
  history: {
    bidId: string;
    bidderLabel: string;
    amount: string;
    acceptedAt: string;
    covered: boolean;
  }[];
};
