import { sectionTitle } from "../typography";
import { DateTimePicker } from "./DateTimePicker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import { useState, type ReactNode } from "react";
import { useSellerStudio, localFuture } from "../../data/useSellerStudio";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { FieldError } from "../../../components/ui/field";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { MoneyInput } from "../../../MoneyInput";

function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={`seller-${name}`} className="text-xs uppercase">
        {label}
      </label>
      {children}
      <FieldError id={`seller-${name}-error`} className="text-xs">
        {error}
      </FieldError>
    </div>
  );
}
export function LotForm({
  model: m,
}: {
  model: ReturnType<typeof useSellerStudio>;
}) {
  const art = m.selected!;
  const [endValue, setEndValue] = useState(() => localFuture(25));
  const accessibility = (name: string) => ({
    id: `seller-${name}`,
    name,
    "aria-invalid": !!m.fieldErrors[name],
    "aria-describedby": m.fieldErrors[name]
      ? `seller-${name}-error`
      : undefined,
  });
  return (
    <div className="space-y-6">
      <Button
        variant="link"
        disabled={m.busy || m.uncertain}
        className="px-0"
        onClick={() => {
          m.setSelected(null);
          m.setError("");
        }}
      >
        ← BACK TO COLLECTION
      </Button>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex aspect-square items-center justify-center bg-muted p-6">
            <img
              src={art.imageUrl!}
              alt={art.name}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-3 uppercase">
            <p className="text-xs text-muted-foreground">
              Selected artwork · CMA {art.articArtworkId}
            </p>
            <h2 className={sectionTitle}>{art.name}</h2>
            <p className="text-sm text-muted-foreground">{art.artistDisplay}</p>
          </div>
          <dl className="grid grid-cols-2 gap-6 border-t pt-6 text-xs uppercase">
            {[
              ["Year", art.dateDisplay],
              ["Medium", art.mediumDisplay],
              ["Type", art.artworkType],
              ["Source", art.provider || "Cleveland / Open Access"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-2">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <form
          noValidate
          onSubmit={m.publish}
          className="space-y-6"
          aria-label="Lot details"
          aria-busy={m.busy}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className={sectionTitle}>Configure the auction</h2>
            <p className="text-sm text-muted-foreground">
              Set the schedule and bidding conditions. Amounts are in USD.
            </p>
          </div>
          <fieldset disabled={m.busy || m.uncertain} className="space-y-6">
            <Field name="title" label="Lot title" error={m.fieldErrors.title}>
              <Input
                {...accessibility("title")}
                defaultValue={art.name}
                maxLength={200}
                className="h-12"
              />
            </Field>
            <Field name="publication" label="Publication">
              <Select
                value={m.startMode}
                disabled={m.busy || m.uncertain}
                onValueChange={(value) => {
                  m.setStartMode(value);
                  if (value === "scheduled") m.setStartValue(localFuture(1));
                  m.setFieldErrors({});
                }}
              >
                <SelectTrigger id="seller-publication" className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Publish now</SelectItem>
                  <SelectItem value="scheduled">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                name="startTime"
                label="Start date & time"
                error={m.fieldErrors.startTime}
              >
                <DateTimePicker
                  id="seller-startTime"
                  name="startTime"
                  label="Start date & time"
                  value={m.startValue}
                  onChange={m.setStartValue}
                  disabled={m.startMode === "now" || m.busy || m.uncertain}
                  error={m.fieldErrors.startTime}
                />
              </Field>
              <Field
                name="endTime"
                label="End date & time"
                error={m.fieldErrors.endTime}
              >
                <DateTimePicker
                  id="seller-endTime"
                  name="endTime"
                  label="End date & time"
                  value={endValue}
                  onChange={setEndValue}
                  disabled={m.busy || m.uncertain}
                  error={m.fieldErrors.endTime}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.startMode === "now" &&
                "Starts when the server publishes the lot. "}
              Times use your device’s local time zone.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ["startingBid", "Starting bid"],
                ["bidIncrement", "Minimum increment"],
                ["estimatedValue", "Estimated value"],
              ].map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={`${label} (USD)`}
                  error={m.fieldErrors[name]}
                >
                  <MoneyInput
                    {...accessibility(name)}
                    className="h-12 w-full border border-input bg-transparent px-3 text-right text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated value is a reference for the artwork, not the starting
              bid. Funds are simulated.
            </p>
            <Button type="submit" className="h-12 w-full">
              {m.busy ? "PUBLISHING…" : "PUBLISH LOT"}
            </Button>
          </fieldset>
          {m.error && (
            <Alert variant="destructive">
              <AlertDescription>{m.error}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
