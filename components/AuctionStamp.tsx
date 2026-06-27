export function AuctionStamp({ state }: { state: "sold" | "unsold" }) {
  if (state === "sold") {
    return (
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
        <div className="auction-sold-stamp">
          <div className="sold-stamp-face">
            <div className="sold-inner-ring" />
            <div className="sold-hatch-layer" />
            <span className="sold-word">SOLD</span>
            <div className="sold-dots">
              <span className="sold-dot" />
              <span className="sold-dot" />
              <span className="sold-dot" />
            </div>
            <span className="sold-sub">Auction finalized</span>
            <div className="sold-bar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
      <div className="auction-unsold-stamp">
        <div className="unsold-stamp-face">
          <div className="unsold-inner-ring" />
          <div className="unsold-hatch-layer" />
          <CrossMark className="corner-tl" />
          <CrossMark className="corner-tr" />
          <CrossMark className="corner-bl" />
          <CrossMark className="corner-br" />
          <span className="unsold-word">UNSOLD</span>
          <span className="unsold-sub">No bids accepted</span>
        </div>
      </div>
    </div>
  );
}

function CrossMark({ className }: { className: string }) {
  return (
    <div className={`cross-mark ${className}`}>
      <div className="cross-h" />
      <div className="cross-v" />
    </div>
  );
}