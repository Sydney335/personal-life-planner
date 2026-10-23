import { useSyncExternalStore } from "react";
import { appInfo, updates, type UpdateStatus } from "./updates";
import type { TextKey } from "./i18n";
type T = (key: TextKey) => string;
const statusKey: Record<UpdateStatus, TextKey> = {
  idle: "updateIdle",
  checking: "updateChecking",
  current: "updateCurrent",
  downloading: "updateDownloading",
  available: "updateReady",
  updating: "updateApplying",
  blocked: "updateBlocked",
  tabs: "updateTabs",
  failed: "updateFailed",
  offline: "updateOffline",
  unsupported: "updateUnsupported",
};
export function UpdateNotice({ t }: { t: T }) {
  const state = useSyncExternalStore(updates.subscribe, updates.getSnapshot);
  if (!state.buildId || state.postponed) return null;
  return (
    <aside
      className="update-notice"
      aria-label={t("updateAvailable")}
      aria-live="polite"
    >
      <strong>{t("updateAvailable")}</strong>
      <p>{t(statusKey[state.status])}</p>
      <small>{t("updateQueueHint")}</small>
      <div className="update-actions">
        <button
          className="primary"
          disabled={state.status === "updating" || state.status === "checking"}
          onClick={() => void updates.apply()}
        >
          {t(state.status === "updating" ? "updateApplying" : "updateNow")}
        </button>
        <button
          className="quiet"
          disabled={state.status === "updating"}
          onClick={updates.later}
        >
          {t("updateLater")}
        </button>
      </div>
    </aside>
  );
}
export function UpdateAbout({ t }: { t: T }) {
  const state = useSyncExternalStore(updates.subscribe, updates.getSnapshot);
  return (
    <section className="card update-about">
      <h2>{t("about")}</h2>
      <dl>
        <dt>{t("appVersion")}</dt>
        <dd>{appInfo.version}</dd>
        <dt>{t("buildIdentifier")}</dt>
        <dd data-testid="running-build">{appInfo.buildId}</dd>
        <dt>{t("updateLastCheck")}</dt>
        <dd>
          {state.lastChecked
            ? new Date(state.lastChecked).toLocaleString(
                document.documentElement.lang,
              )
            : t("updateNever")}
        </dd>
        <dt>{t("updateStatus")}</dt>
        <dd data-testid="update-status">{t(statusKey[state.status])}</dd>
      </dl>
      <button
        className="secondary"
        disabled={state.status === "checking" || state.status === "updating"}
        onClick={() => void updates.check(true)}
      >
        {t("updateCheck")}
      </button>
    </section>
  );
}
