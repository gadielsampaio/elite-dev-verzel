import { dollars, useApiQuery } from './queries';
import { BackButton } from '../shared';
export type Result = {
  lotId: string; title: string; currency: string; endTime: string;
  status: 'settled' | 'awaiting_close' | 'pending_settlement' | 'no_winner';
  items: { name: string; imageUrl: string | null }[];
  receipt: { id: string; amount: string; winnerAlias: string; winningBidId: string; endedAt: string; settledAt: string } | null;
};
export function Receipt({ lotId }: { lotId: string }) {
  const query = useApiQuery<Result>(`/lots/${encodeURIComponent(lotId)}/result`);
  const result = query.data;
  const shareUrl = `${location.origin}/#/receipt/${encodeURIComponent(lotId)}`;
  return <section className="hs-utility-page hs-seller-page" aria-label="Auction result">
    <BackButton />
    <div className="hs-seller"><h1>AUCTION RESULT</h1>
      {query.loading && <p role="status">Loading auction result…</p>}
      {query.error && <p role="alert">{query.error}</p>}
      {result && <><h2>{result.title}</h2>
        {result.status === 'settled' && result.receipt ? <>
          <h3>SETTLED RECEIPT</h3>
          <dl className="hs-seller-artwork-details">
            <div><dt>AMOUNT</dt><dd>{dollars(result.receipt.amount, result.currency)}</dd></div>
            <div><dt>WINNER</dt><dd>{result.receipt.winnerAlias}</dd></div>
            <div><dt>ENDED</dt><dd>{new Date(result.receipt.endedAt).toLocaleString()}</dd></div>
            <div><dt>SETTLED</dt><dd>{new Date(result.receipt.settledAt).toLocaleString()}</dd></div>
            <div><dt>RECEIPT ID</dt><dd>{result.receipt.id}</dd></div>
          </dl>
          <label className="hs-seller-field">SHAREABLE RECEIPT LINK<input className="hs-seller-input" readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} /></label>
          <p>This receipt records a simulated auction settlement. Verify the bid history using the public audit.</p>
        </> : <p role="status">{result.status === 'no_winner' ? 'Closed without a winner. No funds were transferred.' : result.status === 'awaiting_close' ? 'This auction has not ended. No receipt is available yet.' : 'Settlement is pending. No completed sale is confirmed yet.'}</p>}
      </>}
      <p><a href={`#/audit/${lotId}`}>VERIFY BID HISTORY</a></p>
      <button className="hs-seller-btn ghost" disabled={query.loading} onClick={query.refresh}>REFRESH RESULT</button>
    </div>
  </section>;
}
