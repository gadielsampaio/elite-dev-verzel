import { useEffect, useState } from "react";
import { MILLISECONDS_PER_SECOND } from "../constants/time";

export function useClock() {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MILLISECONDS_PER_SECOND);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
