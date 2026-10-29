export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function hasApiStatus(error: unknown, statuses: readonly number[]): error is ApiError {
  return error instanceof ApiError && statuses.includes(error.status);
}
