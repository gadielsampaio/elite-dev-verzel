import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, message, money, type Lot } from "./api";

function Artwork({ lot }: { lot: Lot }) {
  const [failed, setFailed] = useState(false);
  const item = lot.items[0];
  return (
    <div className="artwork">
      {item?.imageUrl && !failed ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>Image unavailable</span>
      )}
    </div>
  );
}
export function LotsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [result, setResult] = useState<{ items: Lot[]; total: number } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    api<{ items: Lot[]; total: number }>(
      `/lots?page=${page}&limit=9${status ? `&status=${encodeURIComponent(status)}` : ""}`,
    )
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => {
        if (active) setError(message(err));
      });
    return () => {
      active = false;
    };
  }, [status, page, refresh]);
  return (
    <>
      <section className="hero">
        <p className="eyebrow">ART · AUCTIONS · DISCOVERY</p>
        <h1>
          Find something
          <br />
          <em>worth looking closer.</em>
        </h1>
        <p>Explore artwork selected for auction.</p>
      </section>
      <section aria-label="Auction lots">
        <div className="toolbar">
          <div className="filters">
            {[
              ["", "All lots"],
              ["open", "Live"],
              ["scheduled", "Upcoming"],
              ["closed", "Closed"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={status === value ? "selected" : ""}
                onClick={() => setParams(value ? { status: value } : {})}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh
          </button>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : !result ? (
          <p role="status">Loading lots…</p>
        ) : result.items.length === 0 ? (
          <div className="empty panel">
            <h2>No lots here yet</h2>
            <p>
              Published lots will appear here. Try another filter or check back
              later.
            </p>
          </div>
        ) : (
          <>
            <div className="lot-grid">
              {result.items.map((lot) => (
                <Link to={`/lots/${lot.id}`} className="lot-card" key={lot.id}>
                  <Artwork lot={lot} />
                  <div className="card-body">
                    <span className={`badge ${lot.status}`}>
                      {lot.status === "open" ? "Live" : lot.status}
                    </span>
                    {lot.items[0]?.sourceSnapshot?.provider === "mock" && (
                      <span className="demo">Demo artwork</span>
                    )}
                    <h2>{lot.title}</h2>
                    <p>{lot.items[0]?.artistDisplay ?? "Artist not listed"}</p>
                    <div className="card-price">
                      <span>Starting bid</span>
                      <strong>{money(lot.startingBid, lot.currency)}</strong>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="pagination">
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() =>
                  setParams({
                    ...(status ? { status } : {}),
                    page: String(page - 1),
                  })
                }
              >
                Previous
              </button>
              <span>
                Page {page} · {result.total} lots
              </span>
              <button
                className="secondary"
                disabled={page * 9 >= result.total}
                onClick={() =>
                  setParams({
                    ...(status ? { status } : {}),
                    page: String(page + 1),
                  })
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
export function LotPage() {
  const { id } = useParams();
  const [lot, setLot] = useState<Lot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLot(null);
    setError("");
    api<Lot>(`/lots/${id}`)
      .then((data) => {
        if (active) setLot(data);
      })
      .catch((err) => {
        if (active) setError(message(err));
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <>
      <Link className="back" to="/lots">
        ← All lots
      </Link>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !lot ? (
        <p role="status">Loading artwork…</p>
      ) : (
        <section className="detail">
          <Artwork lot={lot} />
          <div>
            <span className="badge">{lot.status}</span>
            <h1>{lot.title}</h1>
            <p>{lot.items[0]?.artistDisplay}</p>
            {lot.items[0]?.sourceSnapshot?.provider === "mock" && (
              <p className="notice">
                Demo artwork from the development catalog.
              </p>
            )}
            <dl>
              <dt>Starting bid</dt>
              <dd>{money(lot.startingBid, lot.currency)}</dd>
              <dt>Minimum increment</dt>
              <dd>{money(lot.bidIncrement, lot.currency)}</dd>
              <dt>Starts</dt>
              <dd>{new Date(lot.startTime).toLocaleString()}</dd>
              <dt>Ends</dt>
              <dd>{new Date(lot.endTime).toLocaleString()}</dd>
              <dt>Medium</dt>
              <dd>
                {lot.items[0]?.sourceSnapshot?.mediumDisplay ?? "Not listed"}
              </dd>
            </dl>
            <p className="notice">Bidding is not available yet.</p>
          </div>
        </section>
      )}
    </>
  );
}
