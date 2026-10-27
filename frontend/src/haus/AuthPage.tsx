import { Fragment, useRef, useState, type FormEvent } from "react";
import { useHaus } from "./model";
import { authTranslations } from "./translations";
import { BackButton } from "./shared";
function AuthField({
  id,
  label,
  placeholder,
  password,
  autoComplete,
  error,
  hint,
  type = "text",
  name,
}: {
  id: string;
  label: string;
  placeholder: string;
  password?: boolean;
  autoComplete?: string;
  error?: string;
  hint?: string;
  type?: string;
  name: string;
}) {
  const { lang } = useHaus();
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      id={id}
      name={name}
      type={password ? (shown ? "text" : "password") : type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      maxLength={name === "name" ? 120 : undefined}
      inputMode={type === "email" ? "email" : undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={`${id}-error`}
    />
  );
  return (
    <div className="hs-auth-field">
      <label htmlFor={id}>{label}</label>
      {password ? (
        <div className="hs-auth-password">
          {input}
          <button
            type="button"
            className="hs-auth-show"
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => {
              setShown(!shown);
              ref.current?.focus();
            }}
          >
            {authTranslations[lang][shown ? "hide" : "show"]}
          </button>
        </div>
      ) : (
        input
      )}
      {hint && <span className="hs-auth-hint">{hint}</span>}
      <span className="hs-auth-field-error" id={`${id}-error`}>
        {error}
      </span>
    </div>
  );
}
export type Credentials = {
  name: string;
  email: string;
  password: string;
  role: "bidder" | "auctioneer";
};
export function AuthPage({
  register = false,
  onAuthenticate,
  notice = "",
}: {
  register?: boolean;
  onAuthenticate?: (credentials: Credentials) => Promise<void>;
  notice?: string;
}) {
  const { lang, go, setAccountOpen } = useHaus();
  const s = authTranslations[lang],
    prefix = register ? "register" : "login";
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false),
    [requestError, setRequestError] = useState("");
  const submitting = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    const form = e.currentTarget;
    setRequestError("");
    const data = new FormData(e.currentTarget),
      err: Record<string, string> = {};
    const value = (key: string) => String(data.get(key) || "");
    if (register && value("name").trim().length < 2) err.name = s.nameError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email").trim()))
      err.email = s.emailError;
    if (!value("password")) err.password = s.passwordError;
    else if (register && value("password").length < 8)
      err.password = s.shortPassword;
    if (
      onAuthenticate &&
      register &&
      new TextEncoder().encode(value("password")).length > 72
    )
      err.password =
        lang === "PT"
          ? "A senha deve ter no máximo 72 bytes UTF-8."
          : "Password must be at most 72 UTF-8 bytes.";
    if (register && value("confirm") !== value("password"))
      err.confirm = s.confirmError;
    setErrors(err);
    setValid(!onAuthenticate && !Object.keys(err).length);
    if (Object.keys(err).length)
      e.currentTarget
        .querySelector<HTMLInputElement>(`[name="${Object.keys(err)[0]}"]`)
        ?.focus();
    if (Object.keys(err).length || !onAuthenticate) return;
    submitting.current = true;
    setBusy(true);
    try {
      await onAuthenticate({
        name: value("name").trim(),
        email: value("email").trim(),
        password: value("password"),
        role: value("account-role") === "auctioneer" ? "auctioneer" : "bidder",
      });
      form.reset();
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="hs-auth-page"
      style={{ display: "block" }}
      id={`page-${prefix}`}
      aria-labelledby={`${prefix}-title`}
    >
      <div className="hs-auth-shell">
        <BackButton />
        <div className="hs-auth-layout">
          <div className="hs-auth-intro">
            <p className="hs-seller-eyebrow">
              {register ? s.newAccountEyebrow : s.accessEyebrow}
            </p>
            <h1 id={`${prefix}-title`}>
              {(register ? s.join : s.welcome).split("<br>").map((line, i) => (
                <Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h1>
            <p>{register ? s.registerIntro : s.loginIntro}</p>
            <div className="hs-auth-index">
              {register ? "02" : "01"} / HAUS SAMPAIO{" "}
              <span>{register ? s.registerIndex : s.access}</span>
            </div>
          </div>
          <div className="hs-auth-form-area">
            <div className="hs-auth-form-heading">
              <h2>{register ? s.createTitle : s.signIn}</h2>
              <p>{register ? s.registerSubtitle : s.loginSubtitle}</p>
            </div>
            {notice && (
              <p className="hs-auth-feedback" role="status">
                {notice}
              </p>
            )}
            <form
              id={`${prefix}-form`}
              noValidate
              onSubmit={submit}
              aria-busy={busy}
            >
              {register && (
                <AuthField
                  id="register-name"
                  name="name"
                  label={s.fullName}
                  placeholder={s.namePlaceholder}
                  autoComplete="name"
                  error={errors.name}
                />
              )}
              <AuthField
                id={`${prefix}-email`}
                name="email"
                label={s.email}
                placeholder="name@example.com"
                type="email"
                autoComplete="email"
                error={errors.email}
              />
              {register && (
                <fieldset className="hs-auth-field hs-auth-role-field">
                  <legend>{s.accountType}</legend>
                  <div className="hs-auth-role-options">
                    <label>
                      <input
                        type="radio"
                        name="account-role"
                        value="bidder"
                        defaultChecked
                      />
                      <span>
                        <strong>{s.collector}</strong>
                        <small>{s.collectorDesc}</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="account-role"
                        value="auctioneer"
                      />
                      <span>
                        <strong>{s.auctioneer}</strong>
                        <small>{s.auctioneerDesc}</small>
                      </span>
                    </label>
                  </div>
                </fieldset>
              )}
              <AuthField
                id={`${prefix}-password`}
                name="password"
                label={s.password}
                placeholder={
                  register ? s.newPasswordPlaceholder : s.passwordPlaceholder
                }
                password
                autoComplete={register ? "new-password" : "current-password"}
                hint={register ? s.passwordHint : undefined}
                error={errors.password}
              />
              {register && (
                <AuthField
                  id="register-confirm"
                  name="confirm"
                  label={s.confirmPassword}
                  placeholder={s.confirmPlaceholder}
                  password
                  autoComplete="new-password"
                  error={errors.confirm}
                />
              )}
              <button
                type="submit"
                className="hs-seller-btn hs-auth-submit"
                disabled={busy}
              >
                <span>
                  {busy
                    ? lang === "PT"
                      ? "AGUARDE…"
                      : "PLEASE WAIT…"
                    : register
                      ? s.createButton
                      : s.signIn}
                </span>
                <span aria-hidden="true">↗</span>
              </button>
              {requestError && (
                <p className="hs-auth-feedback" role="alert">
                  {requestError}
                </p>
              )}
              <div
                className={`hs-auth-feedback${valid ? " success" : ""}`}
                role="status"
                aria-live="polite"
              >
                {valid ? (register ? s.validRegister : s.validLogin) : ""}
              </div>
            </form>
            <div className="hs-auth-crosslink">
              <span>{register ? s.haveAccount : s.noAccount}</span>
              <button
                type="button"
                onClick={() => go(register ? "login" : "register")}
              >
                {register ? s.signInAction : s.create}
              </button>
            </div>
            {!onAuthenticate && (
              <div className="hs-auth-demo">
                <span>{s.previewLabel}</span>
                <p>{register ? s.registrationExplain : s.demoExplain}</p>
                <button
                  type="button"
                  className="hs-seller-text-link"
                  onClick={() => setAccountOpen(true)}
                >
                  {s.demoAction}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
