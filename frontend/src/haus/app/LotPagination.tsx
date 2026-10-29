import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "../../components/ui/pagination";
import { useHaus } from "../model";

export function LotPagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  const { lang } = useHaus();
  const pt = lang === "PT";
  const pages: (number | string)[] = [];
  const visible = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  visible.forEach((n, index) => {
    const previous = visible[index - 1];
    if (n - previous === 2) pages.push(previous + 1);
    else if (n - previous > 2) pages.push(`gap-${n}`);
    pages.push(n);
  });
  return (
    <Pagination
      aria-label={pt ? "Paginação dos lotes" : "Lot pagination"}
      className="mx-0 w-auto justify-start sm:justify-end"
    >
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <PaginationPrevious
            label={pt ? "Anterior" : "Previous"}
            aria-label={pt ? "Página anterior" : "Previous page"}
            className="size-8 p-0 text-xs font-normal uppercase text-muted-foreground sm:h-9 sm:w-auto sm:px-3"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
        </PaginationItem>
        {pages.map((n) => (
          <PaginationItem key={n}>
            {typeof n === "number" ? (
              <PaginationLink
                className="size-8 sm:size-9"
                isActive={page === n}
                aria-label={`${pt ? "Página" : "Page"} ${n}`}
                disabled={disabled}
                onClick={() => onPageChange(n)}
              >
                {n}
              </PaginationLink>
            ) : (
              <PaginationEllipsis className="size-8 sm:size-9" />
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            label={pt ? "Próxima" : "Next"}
            aria-label={pt ? "Próxima página" : "Next page"}
            className="size-8 p-0 text-xs font-normal uppercase text-muted-foreground sm:h-9 sm:w-auto sm:px-3"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
