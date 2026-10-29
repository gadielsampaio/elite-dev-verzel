import { returnLot, returnToLot, returnReceipt } from "./room/navigation";
import { pageTitle, sectionTitle } from "./typography";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { api } from "../../api";
import { useSession } from "../../session";
import { useHaus } from "../model";
import { authTranslations } from "../translations";
import { AuthField } from "./AuthField";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { lang, go } = useHaus();
  const { login, session, notice } = useSession();
  const lotId = returnLot();
  const receiptId = returnReceipt();
  const returnQuery = lotId
    ? "?lot=" + lotId
    : receiptId
      ? "?receipt=" + receiptId
      : "";
  const s = authTranslations[lang],
    pt = lang === "PT",
    prefix = register ? "register" : "login";
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [role, setRole] = useState<"bidder" | "auctioneer">("bidder");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || created) return;
    const form = event.currentTarget,
      data = new FormData(form);
    const value = (name: string) => String(data.get(name) || "");
    const name = value("name").trim(),
      email = value("email").trim(),
      password = value("password");
    const next: Record<string, string> = {};
    if (register && name.length < 2) next.name = s.nameError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = s.emailError;
    if (!password) next.password = s.passwordError;
    else if (register && password.length < 8) next.password = s.shortPassword;
    if (register && new TextEncoder().encode(password).length > 72)
      next.password = pt
        ? "A senha deve ter no máximo 72 bytes UTF-8."
        : "Password must be at most 72 UTF-8 bytes.";
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
      if (lotId) returnToLot(lotId);
      else if (receiptId) location.hash = "/receipt/" + receiptId;
      else go("home");
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : pt
            ? "Não foi possível continuar. Tente novamente."
            : "Unable to continue. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`${prefix}-title`}
      className="mx-auto max-w-screen-2xl px-6 py-12 md:px-12 md:py-20"
    >
      <div className="grid gap-12 pb-12 lg:grid-cols-2 lg:gap-24">
        <div className="space-y-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {register ? s.newAccountEyebrow : s.accessEyebrow}
          </p>
          <h1
            id={`${prefix}-title`}
            className={pageTitle + " whitespace-pre-line"}
          >
            {(register ? s.join : s.welcome).replace("<br>", "\n")}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {register ? s.registerIntro : s.loginIntro}
          </p>
          <p className="border-t pt-6 text-xs uppercase tracking-wider text-muted-foreground">
            {register ? "02" : "01"} / HAUS SAMPAIO ·{" "}
            {register ? s.registerIndex : s.access}
          </p>
        </div>
        <div className="w-full max-w-lg space-y-8 lg:justify-self-end">
          <div className="space-y-3">
            <h2 className={sectionTitle}>
              {register ? s.createTitle : s.signIn}
            </h2>
            <p className="text-sm text-muted-foreground">
              {register ? s.registerSubtitle : s.loginSubtitle}
            </p>
          </div>
          {notice && (
            <Alert role="status">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {session ? (
            <div className="space-y-4">
              <p>
                {pt ? "Você já está conectado." : "You are already signed in."}
              </p>
              <Button onClick={() => go("home")}>
                {pt ? "Ver leilões" : "View auctions"}
              </Button>
            </div>
          ) : created ? (
            <Alert role="status">
              <AlertDescription>
                {pt
                  ? "Conta criada. Entre para continuar."
                  : "Account created. Please log in to continue."}
                <Button asChild variant="link">
                  <a href={`/#/login${returnQuery}`}>{s.signIn}</a>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form
              id={`shadcn-${prefix}-form`}
              noValidate
              onSubmit={submit}
              aria-busy={busy}
              className="space-y-6"
            >
              <fieldset disabled={busy} className="space-y-6">
                {register && (
                  <AuthField
                    id="register-name"
                    name="name"
                    label={s.fullName}
                    placeholder={s.namePlaceholder}
                    autoComplete="name"
                    maxLength={120}
                    error={errors.name}
                  />
                )}
                <AuthField
                  id={`${prefix}-email`}
                  name="email"
                  label={s.email}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  error={errors.email}
                />
                {register && (
                  <fieldset className="space-y-3">
                    <legend className="mb-3 text-xs font-medium uppercase tracking-wide">
                      {s.accountType}
                    </legend>
                    <RadioGroup
                      aria-label={s.accountType}
                      value={role}
                      disabled={busy}
                      onValueChange={(value) => {
                        if (value === "bidder" || value === "auctioneer")
                          setRole(value);
                      }}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {(
                        [
                          ["bidder", s.collector, s.collectorDesc],
                          ["auctioneer", s.auctioneer, s.auctioneerDesc],
                        ] as const
                      ).map(([value, title, description]) => (
                        <label
                          key={value}
                          htmlFor={`role-${value}`}
                          className="flex cursor-pointer items-start gap-3 border p-4 has-[[data-state=checked]]:border-primary"
                        >
                          <RadioGroupItem
                            id={`role-${value}`}
                            value={value}
                            className="mt-0.5"
                          />
                          <span className="space-y-1">
                            <span className="block text-xs font-medium">
                              {title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}
                <AuthField
                  id={`${prefix}-password`}
                  name="password"
                  label={s.password}
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? s.newPasswordPlaceholder : s.passwordPlaceholder
                  }
                  hint={register ? s.passwordHint : undefined}
                  error={errors.password}
                />
                {register && (
                  <AuthField
                    id="register-confirm"
                    name="confirm"
                    label={s.confirmPassword}
                    type="password"
                    autoComplete="new-password"
                    placeholder={s.confirmPlaceholder}
                    error={errors.confirm}
                  />
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full justify-between px-6 text-xs uppercase tracking-wider"
                >
                  {busy
                    ? pt
                      ? "Aguarde…"
                      : "Please wait…"
                    : register
                      ? s.createButton
                      : s.signIn}
                </Button>
              </fieldset>
              {requestError && (
                <Alert variant="destructive">
                  <AlertDescription>{requestError}</AlertDescription>
                </Alert>
              )}
            </form>
          )}
          {!session && !created && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-6 text-xs">
              <span className="text-muted-foreground">
                {register ? s.haveAccount : s.noAccount}
              </span>
              <Button asChild variant="link" className="px-0">
                <a href={`/#/${register ? "login" : "register"}${returnQuery}`}>
                  {register ? s.signIn : s.create}
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
