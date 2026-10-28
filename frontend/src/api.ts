const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the API. Check your connection and retry.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    const message = body?.message;
    throw new ApiError(
      Array.isArray(message)
        ? message.join(". ")
        : (message ?? "The request could not be completed."),
      response.status,
    );
  }
  return body as T;
}
export type User = {
  id: string;
  name: string;
  role: "bidder" | "auctioneer" | "admin";
};
export type Wallet = {
  walletId: string | null;
  currency: string;
  total: string;
  committed: string;
  available: string;
};
export type Lot = {
  id: string;
  title: string;
  status: "scheduled" | "open" | "closed";
  currency: string;
  startingBid: string;
  bidIncrement: string;
  startTime: string;
  endTime: string;
  items: {
    id: string;
    name: string;
    imageUrl: string | null;
    artistDisplay: string | null;
    sourceSnapshot: {
      provider?: string;
      mediumDisplay?: string | null;
      dateDisplay?: string | null;
    } | null;
  }[];
};
export function money(value: string, currency = "USD") {
  const [whole, fraction = ""] = value.split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}
