import { useTranslation } from "@/hooks/useTranslation";
import { futureLocalDateTime } from "../../../../utils/time";
import { sectionTitle } from "../../typography";
import { DateTimePicker } from "./DateTimePicker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../../components/ui/select";
import { useState, type ReactNode } from "react";
import { useSellerStudio } from "../../../../hooks/useSellerStudio";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { FieldError } from "../../../../components/ui/field";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { MoneyInput } from "../../../../components/MoneyInput";

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
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={`seller-${name}`} className="text-xs uppercase">
        {label}
      </label>
      {children}
      <FieldError id={`seller-${name}-error`} className="text-xs">
        {t(error ?? "")}
      </FieldError>
    </div>
  );
}
export function LotForm({
  model: studio,
}: {
  model: ReturnType<typeof useSellerStudio>;
}) {
  const { t } = useTranslation();
  const art = studio.selected!;
  const [endValue, setEndValue] = useState(() => futureLocalDateTime(25));
  const accessibility = (name: string) => ({
    id: `seller-${name}`,
    name,
    "aria-invalid": !!studio.fieldErrors[name],
    "aria-describedby": studio.fieldErrors[name]
      ? `seller-${name}-error`
      : undefined,
  });
  return (
    <div className="space-y-6">
      <Button
        variant="link"
        disabled={studio.busy || studio.uncertain}
        className="px-0"
        onClick={() => {
          studio.setSelected(null);
          studio.setError("");
        }}
      >
        {t("← BACK TO COLLECTION")}{" "}
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
              {t("Selected artwork · CMA")} {art.articArtworkId}
            </p>
            <h2 className={sectionTitle}>{art.name}</h2>
            <p className="text-sm text-muted-foreground">{art.artistDisplay}</p>
          </div>
          <dl className="grid grid-cols-2 gap-6 border-t pt-6 text-xs uppercase">
            {[
              [t("Year"), art.dateDisplay],
              [t("Medium"), art.mediumDisplay],
              [t("Type"), art.artworkType],
              [t("Source"), art.provider || t("Cleveland / Open Access")],
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
          onSubmit={studio.publish}
          className="space-y-6"
          aria-label={t("Lot details")}
          aria-busy={studio.busy}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className={sectionTitle}>{t("Configure the auction")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "Set the schedule and bidding conditions. Amounts are in USD.",
              )}{" "}
            </p>
          </div>
          <fieldset
            disabled={studio.busy || studio.uncertain}
            className="space-y-6"
          >
            <Field
              name="title"
              label={t("Lot title")}
              error={studio.fieldErrors.title}
            >
              <Input
                {...accessibility("title")}
                defaultValue={art.name}
                maxLength={200}
                className="h-12"
              />
            </Field>
            <Field name="publication" label={t("Publication")}>
              <Select
                value={studio.startMode}
                disabled={studio.busy || studio.uncertain}
                onValueChange={(value) => {
                  studio.setStartMode(value);
                  if (value === "scheduled")
                    studio.setStartValue(futureLocalDateTime(1));
                  studio.setFieldErrors({});
                }}
              >
                <SelectTrigger id="seller-publication" className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">{t("Publish now")}</SelectItem>
                  <SelectItem value="scheduled">{t("Schedule")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                name="startTime"
                label={t("Start date & time")}
                error={studio.fieldErrors.startTime}
              >
                <DateTimePicker
                  id="seller-startTime"
                  name="startTime"
                  label={t("Start date & time")}
                  value={studio.startValue}
                  onChange={studio.setStartValue}
                  disabled={
                    studio.startMode === "now" ||
                    studio.busy ||
                    studio.uncertain
                  }
                  error={studio.fieldErrors.startTime}
                />
              </Field>
              <Field
                name="endTime"
                label={t("End date & time")}
                error={studio.fieldErrors.endTime}
              >
                <DateTimePicker
                  id="seller-endTime"
                  name="endTime"
                  label={t("End date & time")}
                  value={endValue}
                  onChange={setEndValue}
                  disabled={studio.busy || studio.uncertain}
                  error={studio.fieldErrors.endTime}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              {studio.startMode === "now" &&
                t("Starts when the server publishes the lot. ")}
              {t("Times use your device’s local time zone.")}{" "}
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ["startingBid", t("Starting bid")],
                ["bidIncrement", t("Minimum increment")],
                ["estimatedValue", t("Estimated value")],
              ].map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={`${label} (USD)`}
                  error={studio.fieldErrors[name]}
                >
                  <MoneyInput
                    {...accessibility(name)}
                    className="h-12 w-full border border-input bg-transparent px-3 text-right text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "Estimated value is a reference for the artwork, not the starting bid. Funds are simulated.",
              )}{" "}
            </p>
            <Button type="submit" className="h-12 w-full">
              {studio.busy ? t("PUBLISHING…") : t("PUBLISH LOT")}
            </Button>
          </fieldset>
          {studio.error && (
            <Alert variant="destructive">
              <AlertDescription>{t(studio.error)}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
