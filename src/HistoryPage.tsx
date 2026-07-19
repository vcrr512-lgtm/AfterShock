/**
 * HistoryPage — Secondary spatial panel placeholder for damage details.
 *
 * This scene preserves the WebSpatial two-panel setup while the main page
 * becomes a dashboard scaffold for the new damage visualization UI.
 */

export default function HistoryPage() {
  return (
    <div className="history-page-root">
      <header className="history-header">
        <h1>Detail Panel</h1>
      </header>
      <div className="history-body">
        <p>Select a dot from the main dashboard to show reasoning here.</p>
        <p className="history-note">
          This panel is a placeholder for damage detail and reasoning content.
        </p>
      </div>
    </div>
  );
}
