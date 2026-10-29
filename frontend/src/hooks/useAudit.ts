import { useEffect, useState } from "react";
import { useApiQuery } from "./useApiQuery";
import type { AuditResult } from "../types/audit";
import { verifyAuditInBrowser } from "../utils/verifyAudit";

function auditStatus(data: AuditResult | null, ready: boolean, valid?: boolean | null) {
  if (data?.status === "tampered") return "TAMPERED";
  if (data?.status !== "intact" || !ready || valid === null) return "NOT VERIFIABLE";
  return valid ? "INTACT" : "TAMPERED";
}

export function useAudit(lotId: string | null) {
  const query = useApiQuery<AuditResult>(
    lotId ? `/lots/${encodeURIComponent(lotId)}/audit` : null,
  );
  const [proof, setProof] = useState<{
    data: AuditResult;
    valid: boolean | null;
  } | null>(null);

  useEffect(() => {
    const data = query.data;
    if (!data || data.status !== "intact") return;

    let cancelled = false;
    void verifyAuditInBrowser(data)
      .then((valid) => {
        if (!cancelled) setProof({ data, valid });
      })
      .catch(() => {
        if (!cancelled) setProof({ data, valid: null });
      });

    return () => {
      cancelled = true;
    };
  }, [query.data]);

  const data = query.data;
  const ready = proof?.data === data;
  const status = auditStatus(data, ready, proof?.valid);

  return { query, data, ready, proof, status };
}
