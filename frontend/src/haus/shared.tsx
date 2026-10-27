import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useHaus } from "./model";
import { authTranslations } from "./translations";
export function BackButton() {
  const { go, lang } = useHaus();
  return (
    <button className="ui-back" type="button" onClick={() => go("home")}>
      <span aria-hidden="true">←</span>{" "}
      <span>{authTranslations[lang].back}</span>
    </button>
  );
}
export function MoneyInput({
  value,
  onValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValue: (value: number) => void;
}) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value)}
      onChange={(e) => {
        onValue(
          Number(e.target.value.replace(/\D/g, "").slice(0, 12) || 0) / 100,
        );
      }}
    />
  );
}
export function Modal({
  children,
  onClose,
  className,
  labelledBy,
  id,
}: {
  children: ReactNode;
  onClose: () => void;
  className: string;
  labelledBy: string;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  closeRef.current = onClose;
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          ) || [],
        );
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      queueMicrotask(() => previousFocus.current?.focus());
    };
  }, []);
  return (
    <div
      id={id}
      ref={ref}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
