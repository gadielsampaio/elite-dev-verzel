import { useState, type InputHTMLAttributes } from "react";
import { money } from "./api";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  onValueChange?: (value: string) => void;
};
// Digits enter cents from the right. Decimal strings never pass through Number.
export function MoneyInput({ value, onValueChange, ...props }: Props) {
  const [local, setLocal] = useState("0.00");
  const amount = value === undefined ? local : value || "0.00";
  const cents = amount.replace(/\D/g, "").replace(/^0+/, "") || "0";
  const emit = (digits: string) => {
    digits = digits.replace(/^0+/, "") || "0";
    if (digits.length > 19) return;
    const padded = digits.padStart(3, "0");
    const next = padded.slice(0, -2) + "." + padded.slice(-2);
    setLocal(next);
    onValueChange?.(next);
  };
  const end = (input: HTMLInputElement) =>
    input.setSelectionRange(input.value.length, input.value.length);
  const parse = (text: string) => {
    const clean = text.trim().replace(/[$,\s]/g, "");
    if (!/^\d{1,17}(?:\.\d{0,2})?$/.test(clean)) return;
    const [whole, fraction = ""] = clean.split(".");
    emit(whole + fraction.padEnd(2, "0"));
  };
  return (
    <input
      {...props}
      pattern={undefined}
      type="text"
      inputMode="numeric"
      style={{ ...props.style, textAlign: "right" }}
      value={money(amount).replace("USD ", "$")}
      onClick={(e) => end(e.currentTarget)}
      onKeyDown={(e) => {
        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          e.key === "Tab" ||
          e.key === "Enter"
        )
          return;
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          emit(cents + e.key);
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          emit(cents.slice(0, -1));
        } else {
          e.preventDefault();
          end(e.currentTarget);
        }
      }}
      onChange={(e) => {
        const event = e.nativeEvent as InputEvent;
        if (event.inputType?.startsWith("delete")) emit(cents.slice(0, -1));
        else if (event.data && /^\d$/.test(event.data))
          emit(cents + event.data);
        else parse(e.currentTarget.value);
        end(e.currentTarget);
      }}
      onPaste={(e) => {
        e.preventDefault();
        parse(e.clipboardData.getData("text"));
      }}
    />
  );
}
