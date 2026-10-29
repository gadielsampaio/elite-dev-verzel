import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { validReturnId, lotPath } from "@/haus/app/navigation";
import { useWallet } from "./useWallet";

export function useWalletPage(token: string, userId: string) {
  const { t } = useTranslation();
  const {
    wallet,
    amount,
    setAmount,
    busy,
    error,
    notice,
    pending,
    refresh,
    deposit,
  } = useWallet({ token, userId });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotId = validReturnId(searchParams.get("lot"));
  useEffect(() => {
    if (notice)
      toast.success(t("Deposit recorded"), {
        id: `wallet-deposit-${userId}`,
        description: t(notice),
      });
  }, [notice, userId, t]);
  useEffect(
    () => () => {
      if (!lotId) toast.dismiss(`wallet-deposit-${userId}`);
    },
    [userId, lotId],
  );
  useEffect(() => {
    if (notice && lotId) navigate(lotPath(lotId));
  }, [notice, lotId, navigate]);
  const [fieldError, setFieldError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !pending &&
      !/^(?!0+(?:\.0{1,2})?$)\d{1,17}(?:\.\d{1,2})?$/.test(amount)
    ) {
      setFieldError("Enter an amount greater than $0.00.");
      event.currentTarget
        .querySelector<HTMLInputElement>("#wallet-deposit")
        ?.focus();
      return;
    }
    setFieldError("");
    void deposit(event);
  }
  return {
    wallet,
    amount,
    setAmount,
    busy,
    error,
    notice,
    pending,
    lotId,
    fieldError,
    setFieldError,
    refreshing,
    reload,
    submit,
  };
}
