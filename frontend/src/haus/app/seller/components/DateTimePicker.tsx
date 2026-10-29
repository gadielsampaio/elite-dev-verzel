import { enUS, ptBR } from "react-day-picker/locale";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "../../../../components/ui/button";
import { Calendar } from "../../../../components/ui/calendar";
import { Input } from "../../../../components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../components/ui/popover";

// shadcn date/time composition: Calendar in Popover + Input type="time".
// Keep local date/time strings until the shared publication handler converts to UTC.
export function DateTimePicker({
  id,
  name,
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "PT" ? ptBR : enUS;
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const earliest = new Date((Math.floor(now / 60000) + 1) * 60000);
  const earliestDay = format(earliest, "yyyy-MM-dd");
  const earliestTime = format(earliest, "HH:mm");
  const [datePart, timePart = ""] = value.split("T");
  const parsed = datePart ? parseISO(datePart) : undefined;
  const date = parsed && isValid(parsed) ? parsed : undefined;
  const description = error ? `${id}-error` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          setNow(Date.now());
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            data-field={name}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={description}
            className="h-12 w-full justify-between gap-2 px-3 text-left font-normal"
          >
            <span>
              {date
                ? format(date, lang === "PT" ? "d MMM yyyy" : "MMM d, yyyy", {
                    locale,
                  })
                : t("Select date")}
            </span>
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          aria-label={t("{label} calendar", { label })}
        >
          <Calendar
            mode="single"
            locale={locale}
            selected={date}
            defaultMonth={date}
            disabled={(day) => format(day, "yyyy-MM-dd") < earliestDay}
            onSelect={(day) => {
              if (day) {
                const chosenDay = format(day, "yyyy-MM-dd");
                const chosenTime = timePart || "00:00";
                onChange(
                  `${chosenDay}T${chosenDay === earliestDay && chosenTime < earliestTime ? earliestTime : chosenTime}`,
                );
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={60}
        min={datePart === earliestDay ? earliestTime : undefined}
        onFocus={() => setNow(Date.now())}
        onBlur={() => {
          const current = Date.now();
          setNow(current);
          if (
            value &&
            isValid(parseISO(value)) &&
            parseISO(value).getTime() <= current
          ) {
            onChange(
              format(
                new Date((Math.floor(current / 60000) + 1) * 60000),
                "yyyy-MM-dd'T'HH:mm",
              ),
            );
          }
        }}
        aria-label={t("{label} time", { label })}
        aria-invalid={!!error}
        aria-describedby={description}
        value={timePart}
        onChange={(event) => onChange(`${datePart}T${event.target.value}`)}
        disabled={disabled}
        className="h-12 min-w-0"
      />
    </div>
  );
}
