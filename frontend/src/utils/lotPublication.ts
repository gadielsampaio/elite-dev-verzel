const MAX_TITLE_LENGTH = 200;
const POSITIVE_AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d{1,17}(?:\.\d{1,2})?$/;

export function readLotPublication(form: FormData, startMode: string) {
  const value = (name: string) => String(form.get(name) ?? "").trim();
  const moneyValue = (name: string) => value(name).replace(/[$,]/g, "");
  const title = value("title");
  const amounts = {
    startingBid: moneyValue("startingBid"),
    bidIncrement: moneyValue("bidIncrement"),
    estimatedValue: moneyValue("estimatedValue"),
  };
  const errors: Record<string, string> = {};

  if (!title || title.length > MAX_TITLE_LENGTH) {
    errors.title = "Enter a title of 1–200 characters.";
  }

  for (const [name, amount] of Object.entries(amounts)) {
    if (!POSITIVE_AMOUNT_PATTERN.test(amount)) {
      errors[name] = "Enter an amount greater than $0.00.";
    }
  }

  const start = startMode === "now" ? new Date() : new Date(value("startTime"));
  const end = new Date(value("endTime"));
  if (
    !Number.isFinite(start.getTime()) ||
    (startMode !== "now" && start.getTime() <= Date.now())
  ) {
    errors.startTime = "Choose a future start time or Publish now.";
  }
  if (!Number.isFinite(end.getTime()) || end <= start) {
    errors.endTime = "End time must be after the start.";
  }

  if (Object.keys(errors).length) return { errors, payload: null };

  return {
    errors,
    payload: {
      title,
      ...amounts,
      ...(startMode === "now" ? { startMode: "now" } : { startTime: start.toISOString() }),
      endTime: end.toISOString(),
    },
  };
}

export function focusFirstInvalidField(form: HTMLFormElement, errors: Record<string, string>) {
  const name = Object.keys(errors)[0];
  if (!name) return;

  form.querySelector<HTMLElement>(
    `[data-field="${name}"], [name="${name}"]:not([type="hidden"])`,
  )?.focus();
}
