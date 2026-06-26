export default function AppLoading() {
  return (
    <div className="route-loading" aria-label="Chargement">
      <div className="route-loading-head">
        <div className="route-skeleton route-skeleton-eyebrow" />
        <div className="route-skeleton route-skeleton-title" />
        <div className="route-skeleton route-skeleton-subtitle" />
      </div>

      <div className="route-loading-stats">
        <div className="route-skeleton route-skeleton-card" />
        <div className="route-skeleton route-skeleton-card" />
        <div className="route-skeleton route-skeleton-card" />
        <div className="route-skeleton route-skeleton-card" />
      </div>

      <div className="route-skeleton route-skeleton-panel" />
      <div className="route-skeleton route-skeleton-panel route-skeleton-panel-short" />
    </div>
  );
}
