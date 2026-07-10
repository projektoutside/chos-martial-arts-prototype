import { testingUpdateNotices } from "./testingUpdateNotice";

export function TestingUpdateHistoryDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card testing-update-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="testing-update-history-title"
      >
        <div className="modal-header">
          <h2 id="testing-update-history-title">App updates</h2>
          <button type="button" aria-label="Close app updates" onClick={onClose}>
            Close
          </button>
        </div>

        {testingUpdateNotices.length > 0 ? (
          <ol>
            {testingUpdateNotices.map((entry) => (
              <li key={entry.id}>
                <div>
                  <span>Version {entry.version}</span>
                  <span>{entry.date}</span>
                </div>
                <h3>{entry.title}</h3>
                <ul>
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p>No app updates are available yet.</p>
        )}
      </section>
    </div>
  );
}
