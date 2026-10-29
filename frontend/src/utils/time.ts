import {
  MILLISECONDS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from "../constants/time";

export function formatCountdown(end: number, now: number) {
  const seconds = Math.max(0, Math.floor((end - now) / MILLISECONDS_PER_SECOND));
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const time = [
    Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds % SECONDS_PER_MINUTE,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return days ? `${days}d ${time}` : time;
}

export function futureLocalDateTime(hours: number) {
  const date = new Date(Date.now() + hours * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND);
  const timezoneOffset = date.getTimezoneOffset() * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}
