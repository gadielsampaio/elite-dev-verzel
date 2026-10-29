import {
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { dollars } from "../utils/money";

const DECIMAL_PLACES = 2;
const MAX_WHOLE_DIGITS = 17;
const MAX_AMOUNT_DIGITS = MAX_WHOLE_DIGITS + DECIMAL_PLACES;
const ZERO_AMOUNT = "0.00";
const SINGLE_DIGIT_PATTERN = /^\d$/;
const DECIMAL_AMOUNT_PATTERN = new RegExp(
  `^\\d{1,${MAX_WHOLE_DIGITS}}(?:\\.\\d{0,${DECIMAL_PLACES}})?$`,
);

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

function normalizeDigits(digits: string) {
  return digits.replace(/^0+/, "") || "0";
}

// Digits enter cents from the right. Decimal strings never pass through Number.
function amountFromDigits(digits: string): string | null {
  const normalized = normalizeDigits(digits);
  if (normalized.length > MAX_AMOUNT_DIGITS) return null;

  const padded = normalized.padStart(DECIMAL_PLACES + 1, "0");
  return `${padded.slice(0, -DECIMAL_PLACES)}.${padded.slice(-DECIMAL_PLACES)}`;
}

function parseAmount(text: string): string | null {
  const cleaned = text.trim().replace(/[$,\s]/g, "");
  if (!DECIMAL_AMOUNT_PATTERN.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  return amountFromDigits(whole + fraction.padEnd(DECIMAL_PLACES, "0"));
}

function amountFromInputEvent(
  event: InputEvent,
  currentDigits: string,
  inputValue: string,
): string | null {
  if (event.inputType?.startsWith("delete")) {
    return amountFromDigits(currentDigits.slice(0, -1));
  }

  if (event.data && SINGLE_DIGIT_PATTERN.test(event.data)) {
    return amountFromDigits(currentDigits + event.data);
  }

  return parseAmount(inputValue);
}

function moveCaretToEnd(input: HTMLInputElement) {
  input.setSelectionRange(input.value.length, input.value.length);
}

export function MoneyInput({ value, onValueChange, ...props }: Props) {
  const [localAmount, setLocalAmount] = useState(ZERO_AMOUNT);
  const amount = value === undefined ? localAmount : value || ZERO_AMOUNT;
  const digits = normalizeDigits(amount.replace(/\D/g, ""));

  function updateAmount(nextAmount: string | null) {
    if (nextAmount === null) return;

    setLocalAmount(nextAmount);
    onValueChange?.(nextAmount);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key === "Tab" ||
      event.key === "Enter"
    ) {
      return;
    }

    event.preventDefault();

    if (SINGLE_DIGIT_PATTERN.test(event.key)) {
      updateAmount(amountFromDigits(digits + event.key));
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      updateAmount(amountFromDigits(digits.slice(0, -1)));
      return;
    }

    moveCaretToEnd(event.currentTarget);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    updateAmount(
      amountFromInputEvent(
        event.nativeEvent as InputEvent,
        digits,
        event.currentTarget.value,
      ),
    );
    moveCaretToEnd(event.currentTarget);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    updateAmount(parseAmount(event.clipboardData.getData("text")));
  }

  return (
    <input
      {...props}
      pattern={undefined}
      type="text"
      inputMode="numeric"
      style={{ ...props.style, textAlign: "right" }}
      value={dollars(amount)}
      onClick={(event) => moveCaretToEnd(event.currentTarget)}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onPaste={handlePaste}
    />
  );
}
