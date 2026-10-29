import { ClosedLots } from "./ClosedLots";
import { useTranslation } from "@/hooks/useTranslation";
import { auditExplanation } from "./presentation";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { format } from "date-fns";
import { RefreshCw, ShieldCheck, ShieldAlert, Search } from "lucide-react";
import { useAudit } from "../../../hooks/useAudit";
import { dollars } from "../../../utils/money";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { FieldError } from "../../../components/ui/field";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../../components/ui/accordion";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../../../components/ui/table";
import { pageTitle, sectionTitle } from "../typography";

export function PublicAuditPage() {
  const { lotId } = useParams();
  return <PublicAuditContent key={lotId ?? "missing"} lotId={lotId ?? null} />;
}

function PublicAuditContent({ lotId }: { lotId: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState(lotId ?? "");
  const [fieldError, setFieldError] = useState("");
  const { query, data, ready, proof, status } = useAudit(lotId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = input.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      setFieldError(t("Enter a valid lot ID (UUID)."));
      event.currentTarget
        .querySelector<HTMLInputElement>("#audit-lot-id")
        ?.focus();
      return;
    }
    setFieldError("");
    setInput(id);
    if (id === lotId) query.refresh();
    else navigate(`/audit/${encodeURIComponent(id)}`);
  }
  const explanation = auditExplanation(data, status, ready, proof?.valid);

  return (
    <section
      className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24"
      aria-labelledby="public-audit-title"
    >
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("Public records / Verification")}{" "}
        </p>
        <h1 id="public-audit-title" className={pageTitle}>
          {t("Public audit")}{" "}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t(
            "Verify a lot’s bid history against protected audit snapshots. No login required.",
          )}{" "}
        </p>
      </header>
      <form
        noValidate
        onSubmit={submit}
        className="grid items-start gap-4 border-y py-6 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="min-w-0 space-y-2">
          <label htmlFor="audit-lot-id" className="block text-xs uppercase">
            {t("Lot ID")}{" "}
          </label>
          <Input
            id="audit-lot-id"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setFieldError("");
            }}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "audit-id-error" : "audit-id-help"}
            placeholder={t("Enter the lot UUID")}
            autoComplete="off"
            spellCheck={false}
            className="h-12"
          />
          <FieldError id="audit-id-error">{t(fieldError)}</FieldError>
          <p
            id="audit-id-help"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {t("Use the lot ID or open a direct audit link.")}{" "}
          </p>
        </div>
        <Button
          type="submit"
          disabled={query.loading}
          className="h-12 uppercase sm:mt-6"
        >
          <Search aria-hidden="true" />
          {t("Verify history")}{" "}
        </Button>
      </form>
      {query.loading && (
        <LoadingSkeleton label={t("Loading audit…")} layout="rows" />
      )}
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{t(query.error)}</AlertDescription>
          <Button
            variant="outline"
            className="mt-4 uppercase"
            onClick={query.refresh}
          >
            <RefreshCw aria-hidden="true" />
            {t("Retry verification")}{" "}
          </Button>
        </Alert>
      )}
      {!lotId && <ClosedLots />}
      {!lotId && (
        <Alert>
          <ShieldCheck className="size-4" aria-hidden="true" />
          <AlertTitle>{t("Check an auction")}</AlertTitle>
          <AlertDescription>
            {t(
              "Enter a lot ID to inspect its recorded bids and verify their integrity.",
            )}{" "}
          </AlertDescription>
        </Alert>
      )}
      {data && (
        <div className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <p className="break-all text-[10px] uppercase text-muted-foreground">
                {t("Lot")} {data.lotId}
              </p>
              <h2 className={sectionTitle}>{data.title}</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("Refresh verification")}
              title={t("Refresh verification")}
              className="shrink-0"
              disabled={query.loading}
              onClick={query.refresh}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
          <Alert variant={status === "TAMPERED" ? "destructive" : "default"}>
            {status === "INTACT" ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-4" aria-hidden="true" />
            )}
            <AlertTitle>
              <span role="status">{t(status)}</span>
            </AlertTitle>
            <AlertDescription>{t(explanation ?? "")}</AlertDescription>
          </Alert>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              "Checked {date}. This is a point-in-time check; refresh for new bids or direct database changes.",
              { date: format(new Date(data.checkedAt), "dd/MM/yy HH:mm") },
            )}
          </p>
          <section
            className="min-w-0 space-y-4"
            aria-labelledby="bid-history-title"
          >
            <h3
              id="bid-history-title"
              className="font-display text-xl font-semibold uppercase tracking-tight"
            >
              {t("Complete bid history")}{" "}
            </h3>
            {data.history.length === 0 ? (
              <p className="border px-6 py-10 text-center text-sm text-muted-foreground">
                {t("No recorded bids.")}{" "}
              </p>
            ) : (
              <Table className="min-w-[48rem] table-fixed">
                <TableCaption className="text-left text-xs leading-relaxed">
                  {t(
                    "All recorded bids, including any outside audit coverage. Times use your device’s local time zone.",
                  )}{" "}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="w-1/4 px-4 text-[10px] uppercase">
                      {t("Bidder")}{" "}
                    </TableHead>
                    <TableHead scope="col" className="w-1/4 px-4 text-center text-[10px] uppercase">
                      {t("Amount")}{" "}
                    </TableHead>
                    <TableHead scope="col" className="w-1/4 px-4 text-center text-[10px] uppercase">
                      {t("Accepted")}{" "}
                    </TableHead>
                    <TableHead scope="col" className="w-1/4 px-4 text-center text-[10px] uppercase">
                      {t("Coverage")}{" "}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((bid) => (
                    <TableRow key={bid.bidId}>
                      <TableCell className="break-words px-4 py-4 text-sm font-medium">
                        {bid.bidderLabel}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-center text-sm tabular-nums">
                        {dollars(
                          bid.amount,
                          data.entries.find((e) => e.bidId === bid.bidId)
                            ?.currency ?? "USD",
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-center text-xs tabular-nums text-muted-foreground">
                        {format(new Date(bid.acceptedAt), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap rounded-none text-[10px] font-normal uppercase"
                        >
                          {bid.covered
                            ? t("Covered")
                            : t("Outside audit coverage")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
          <Accordion type="multiple">
            {data.checkpoint && (
              <AccordionItem value="checkpoint">
                <AccordionTrigger className="font-display text-sm uppercase">
                  {t("Audit checkpoint")}{" "}
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p className="text-sm">
                    {t("Sequence")} {data.checkpoint.sequence}
                  </p>
                  <code className="block break-all border bg-muted/30 p-4 text-xs leading-relaxed">
                    {data.checkpoint.hash}
                  </code>
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="scope">
              <AccordionTrigger className="font-display text-sm uppercase">
                {t("Verification scope")}{" "}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  {t(
                    "The browser recomputes SHA-256 hashes and compares the chain with the audit checkpoint before displaying INTACT. A tampering result from the API is never overridden.",
                  )}{" "}
                </p>
                <p>
                  {t(
                    "Trust boundary: the API, audit history and database triggers. Direct history edits are detected; an administrator who disables these protections is outside this guarantee.",
                  )}{" "}
                </p>
                <p>
                  {t(
                    "Missing checkpoints, uncovered history or unavailable verification cannot establish integrity.",
                  )}{" "}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </section>
  );
}
