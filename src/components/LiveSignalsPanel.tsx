import Icon from './Icon'

function LiveSignalsPanel() {
  return (
    <aside className="panel signals-panel" aria-labelledby="signals-heading">
      <div className="panel-header">
        <h2 id="signals-heading">Live Signals</h2>
        <span className="availability-label">Coming soon</span>
      </div>
      <p className="supporting-text provider-description">Presage camera measurements</p>

      <div className="camera-placeholder">
        <Icon name="camera" />
        <p className="placeholder-title">Camera not connected</p>
        <p className="supporting-text">No video is being captured.</p>
      </div>

      <dl className="signal-metrics">
        <div>
          <dt>Pulse rate</dt>
          <dd>-- <span>bpm</span></dd>
        </div>
        <div>
          <dt>Breathing rate</dt>
          <dd>-- <span>breaths/min</span></dd>
        </div>
      </dl>

      <div className="connection-status">
        <span>Measurement status</span>
        <strong>Not connected</strong>
      </div>
      <p className="supporting-text signal-note">Only valid readings will be shown. Breathing measurements may be unavailable during speech.</p>
    </aside>
  )
}

export default LiveSignalsPanel
