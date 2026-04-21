export default function GlobalLoading() {
  return (
    <div className="page-loading-shell" aria-live="polite" aria-busy="true">
      <div className="page-loading-card">
        <div className="global-spinner" />
        <div className="page-loading-copy">
          <strong>Loading...</strong>
          <span>Please wait while the next screen is prepared.</span>
        </div>
      </div>
    </div>
  );
}
