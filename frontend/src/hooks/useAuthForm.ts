import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { validReturnId, lotPath } from "@/haus/app/navigation";
import { authTranslations } from "@/haus/translations";
import { useSession } from "./useSession";
import { useTranslation } from "./useTranslation";
import { api } from "@/api/client";

const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function authReturnQuery(lotId: string | null, receiptId: string | null) {
  if (lotId) return "?lot=" + lotId;
  if (receiptId) return "?receipt=" + receiptId;
  return "";
}

export function useAuthForm(register: boolean) {
  const { lang, t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, session, notice } = useSession();
  const lotId = validReturnId(searchParams.get("lot"));
  const receiptId = validReturnId(searchParams.get("receipt"));
  const returnQuery = authReturnQuery(lotId, receiptId);
  const s = authTranslations[lang];
  const prefix = register ? "register" : "login";
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [role, setRole] = useState<"bidder" | "auctioneer">("bidder");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || created) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) || "");
    const name = value("name").trim();
    const email = value("email").trim();
    const password = value("password");
    const next: Record<string, string> = {};
    if (register && name.length < MIN_NAME_LENGTH) next.name = s.nameError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = s.emailError;
    if (!password) next.password = s.passwordError;
    else if (register && password.length < MIN_PASSWORD_LENGTH)
      next.password = s.shortPassword;
    if (
      register &&
      new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES
    )
      next.password = t("Password must be at most 72 UTF-8 bytes.");
    if (register && value("confirm") !== password)
      next.confirm = s.confirmError;
    setErrors(next);
    setRequestError("");
    if (Object.keys(next).length) {
      form
        .querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)
        ?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (register) {
        await api("/auth/register", undefined, {
          method: "POST",
          body: JSON.stringify({ name, email, password, role }),
        });
        // Account creation succeeded. A failed automatic login must never repeat registration.
        try {
          await login(email, password);
        } catch {
          setCreated(true);
          form.reset();
          return;
        }
      } else await login(email, password);
      if (lotId) navigate(lotPath(lotId));
      else if (receiptId) navigate("/receipt/" + receiptId);
      else navigate("/home");
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : t("Unable to continue. Please retry."),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return {
    s,
    prefix,
    session,
    notice,
    returnQuery,
    busy,
    created,
    role,
    setRole,
    errors,
    requestError,
    submit,
    viewAuctions: () => navigate("/home"),
  };
}
