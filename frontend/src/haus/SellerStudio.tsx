import { useState } from "react";
import { current, money, status, useHaus } from "./model";
import { BackButton } from "./shared";
import { SellerSearch } from "./SellerSearch";
import { initialDraft, SellerDetails } from "./SellerDetails";
import type { CatalogArtwork, Lot } from "./types";
function SellerLotRow({ lot }: { lot: Lot }) {
  const { lots, role, saveLots } = useHaus();
  const state = status(lot),
    sold = state === "closed" && lot.bids.length > 0;
  function cancel() {
    if (role !== "Auctioneer") {
      alert("Switch to the Auctioneer demo account.");
      return;
    }
    if (
      confirm("Cancel this lot? It will be removed from the public collection.")
    ) {
      const warning = saveLots(
        lots.map((l) => (l.id === lot.id ? { ...l, status: "cancelled" } : l)),
      );
      if (warning) alert(warning);
    }
  }
  return (
    <div className="hs-seller-row">
      <img
        src={lot.image}
        alt=""
        onError={(e) => {
          e.currentTarget.style.opacity = ".18";
        }}
      />
      <div>
        <div className="hs-seller-row-title">{lot.title}</div>
        <div className="hs-seller-row-sub">
          LOT {String(lots.indexOf(lot) + 1).padStart(3, "0")} · {lot.artist}
        </div>
        <div className="hs-seller-row-sub">
          <span className="hs-seller-tag">
            {state === "closed" ? (sold ? "SOLD" : "UNSOLD") : state}
          </span>{" "}
          · {lot.bids.length} bid(s)
        </div>
      </div>
      <div className="hs-seller-date hs-seller-muted">
        {lot.startsAt
          ? new Date(lot.startsAt).toLocaleDateString("en-GB")
          : "—"}
        <br />
        TO {new Date(lot.endsAt).toLocaleDateString("en-GB")}
      </div>
      <div className="hs-seller-price">
        {state === "closed" && !sold ? "—" : money(current(lot))}
      </div>
      <div className="hs-seller-action">
        {state !== "cancelled" && !lot.bids.length && state !== "closed" ? (
          <button
            className="hs-seller-btn ghost"
            style={{ padding: 10, fontSize: 9 }}
            onClick={cancel}
          >
            CANCEL LOT
          </button>
        ) : (
          <span className="hs-seller-muted">
            {state === "closed" ? (sold ? "SOLD" : "NO WINNER") : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
export function SellerStudio() {
  const { lots, role, saveLots, now } = useHaus();
  const [tab, setTab] = useState("lots"),
    [step, setStep] = useState("search"),
    [selected, setSelected] = useState<CatalogArtwork | null>(null),
    [draft, setDraft] = useState(initialDraft),
    [success, setSuccess] = useState("");
  const own = lots.filter((l) => l.seller === "Auctioneer" || !l.seller),
    closed = own.filter((l) => status(l, now) === "closed"),
    sold = closed.filter((l) => l.bids.length),
    received = sold.reduce((sum, l) => sum + current(l), 0);
  function publish(art: CatalogArtwork) {
    if (role !== "Auctioneer")
      return "Switch to the Auctioneer demo account to publish a lot.";
    const lot: Lot = {
      id: `lot-${crypto.randomUUID()}`,
      title: draft.title.trim(),
      artist: art.artist,
      year: art.year,
      image: art.image,
      description: art.medium || art.artworkType,
      provider: art.provider,
      sourceId: art.id,
      medium: art.medium,
      sourceFetchedAt: new Date().toISOString(),
      sourceSnapshot: {
        id: art.id,
        title: art.title,
        artist: art.artist,
        year: art.year,
        medium: art.medium,
        artworkType: art.artworkType,
        imageUrl: art.image,
        isPublicDomain: art.isPublicDomain,
        provider: art.provider,
      },
      estimatedValue: draft.estimated,
      status: "scheduled",
      startsAt: Date.parse(draft.start),
      endsAt: Date.parse(draft.end),
      start: draft.opening,
      increment: draft.increment,
      bids: [],
      seller: "Auctioneer",
    };
    const warning = saveLots([...lots, lot]);
    setSuccess(
      `${lot.title} This is a local preview, not a real auction.${warning ? " " + warning : ""}`,
    );
    setSelected(null);
    setDraft(initialDraft());
    setStep("search");
    setTab("lots");
    return "";
  }
  return (
    <section
      className="hs-tools-preview hs-seller-page"
      style={{ display: "block" }}
      id="page-seller"
      aria-label="Seller Studio"
    >
      <BackButton />
      <div className="hs-seller">
        <div className="hs-seller-heading">
          <div>
            <p className="hs-seller-eyebrow">PRIVATE AREA / AUCTIONEER</p>
            <h2>SELLER STUDIO</h2>
            <p className="hs-seller-intro">
              Manage your collection, live auctions and final results.
            </p>
          </div>
          <button className="hs-seller-btn" onClick={() => setTab("create")}>
            CREATE LOT<span>+</span>
          </button>
        </div>
        <div className="hs-seller-stats">
          {[
            ["YOUR LOTS", own.length],
            ["LIVE NOW", own.filter((l) => status(l, now) === "live").length],
            ["LOTS SOLD", sold.length],
            ["TOTAL RECEIVED", money(received)],
          ].map(([label, value]) => (
            <div className="hs-seller-stat" key={label}>
              <label>{label}</label>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="hs-seller-tabs" role="tablist">
          {[
            ["lots", "MY LOTS"],
            ["create", "CREATE A LOT"],
            ["results", "RESULTS"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          {tab === "lots" && (
            <>
              {success && (
                <div className="hs-seller-flash" role="status">
                  <span>✓</span>
                  <div>
                    <strong>LOT ADDED TO YOUR COLLECTION</strong>
                    <p>{success}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccess("")}
                    aria-label="Dismiss message"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="hs-seller-subheading">
                <h3 className="hs-seller-section-title">YOUR COLLECTION</h3>
                <span className="hs-seller-muted">{own.length} LOTS</span>
              </div>
              {own.length ? (
                own.map((l) => <SellerLotRow key={l.id} lot={l} />)
              ) : (
                <div className="hs-seller-empty">
                  No lots yet. Create your first auction.
                </div>
              )}
              <p className="hs-seller-notice">
                Cancellation is available only before the first bid. Cancelled
                lots are excluded from the public collection.
              </p>
            </>
          )}
          {tab === "results" && (
            <>
              <div className="hs-seller-subheading">
                <h3 className="hs-seller-section-title">CLOSED AUCTIONS</h3>
                <span className="hs-seller-muted">{closed.length} RESULTS</span>
              </div>
              {closed.length ? (
                closed.map((l) => <SellerLotRow key={l.id} lot={l} />)
              ) : (
                <div className="hs-seller-empty">No closed auctions yet.</div>
              )}
              <div className="hs-seller-total">
                <span>TOTAL RECEIVED · {sold.length} SOLD</span>
                <strong>{money(received)}</strong>
              </div>
              <p className="hs-seller-notice">
                Demo totals represent winning bids only. Actual fund settlement
                requires backend integration.
              </p>
            </>
          )}
          <div hidden={tab !== "create"}>
            <div className="hs-seller-create-intro">
              <div>
                <p className="hs-seller-eyebrow">
                  NEW AUCTION /{" "}
                  {step === "search" ? "STEP 01 OF 02" : "STEP 02 OF 02"}
                </p>
                <h3>CREATE A LOT</h3>
                <p>
                  {step === "search"
                    ? "Choose a work from the public collection to begin."
                    : "Set the conditions for your selected work."}
                </p>
              </div>
              <div
                className="hs-seller-progress"
                aria-label="Lot creation progress"
              >
                <div className={step === "search" ? "is-active" : "is-done"}>
                  <span className="hs-seller-step-number">
                    {step === "search" ? "01" : "✓"}
                  </span>
                  <span>SELECT ARTWORK</span>
                </div>
                <span className="hs-seller-progress-line" aria-hidden="true" />
                <div className={step === "details" ? "is-active" : ""}>
                  <span className="hs-seller-step-number">02</span>
                  <span>LOT DETAILS</span>
                </div>
              </div>
            </div>
            <div hidden={step !== "search"}>
              <SellerSearch
                onSelect={(art) => {
                  setSelected(art);
                  setDraft({ ...draft, title: art.title });
                  setStep("details");
                }}
              />
            </div>
            {step === "details" && selected && (
              <SellerDetails
                key={selected.id}
                art={selected}
                draft={draft}
                setDraft={setDraft}
                back={() => setStep("search")}
                publish={publish}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
