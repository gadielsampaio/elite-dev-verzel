import { useEffect, useRef } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";
import { useSession } from "../../../hooks/useSession";
import { validReturnId } from "../navigation";

export function RouteEffects() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { session, notice } = useSession();
  const handledNotice = useRef<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  useEffect(() => {
    if (session || !notice) {
      handledNotice.current = null;
      return;
    }

    if (handledNotice.current === notice) return;
    handledNotice.current = notice;

    const lotId = validReturnId(matchPath("/lot/:id", pathname)?.params.id);
    const receiptId = validReturnId(matchPath("/receipt/:id", pathname)?.params.id);
    const returnQuery = new URLSearchParams();
    if (lotId) returnQuery.set("lot", lotId);
    else if (receiptId) returnQuery.set("receipt", receiptId);

    const query = returnQuery.toString();
    navigate(query ? `/login?${query}` : "/login");
  }, [session, notice, pathname, navigate]);

  return null;
}
