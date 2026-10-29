import { useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { FieldError } from "../../components/ui/field";
import { useHaus } from "../model";

type Props = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};
export function AuthField({ id, label, error, hint, type, ...props }: Props) {
  const { lang } = useHaus();
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const password = type === "password";
  const description =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide"
      >
        {label}
      </label>
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          id={id}
          type={password && shown ? "text" : type}
          className={`h-12 ${password ? "pr-12" : ""}`}
          aria-invalid={!!error}
          aria-describedby={description}
        />
        {password && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1"
            aria-label={
              lang === "PT"
                ? shown
                  ? "Ocultar senha"
                  : "Mostrar senha"
                : shown
                  ? "Hide password"
                  : "Show password"
            }
            aria-pressed={shown}
            onClick={() => {
              setShown(!shown);
              ref.current?.focus();
            }}
          >
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} className="text-xs">
        {error}
      </FieldError>
    </div>
  );
}
