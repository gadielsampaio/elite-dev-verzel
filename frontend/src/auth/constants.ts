import { MILLISECONDS_PER_SECOND } from "../constants/time";

export const SESSION_REFRESH_LEAD_MS = 60 * MILLISECONDS_PER_SECOND;
export const SESSION_RETRY_DELAY_MS = 30 * MILLISECONDS_PER_SECOND;
export const SESSION_REFRESH_LOCK = "auction-refresh";
export const SESSION_BROADCAST_CHANNEL = "auction-auth";
export const LEGACY_SESSION_STORAGE_KEY = "auction-session-token";
export const SESSION_EXPIRED_NOTICE = "Your session expired. Please sign in again.";
