import { useRef, useState } from 'react'
import { api } from '../api'

// Upload any shift CSV; on success the whole dashboard refreshes against it.
export default function UploadCard({ onUploaded }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await api.upload(file)
      setStatus({ ok: true, msg: `Loaded: ${res.summary.valid}/${res.summary.total} valid rows.` })
      onUploaded()
    } catch (e) {
      setStatus({ ok: false, msg: e.message })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="upload">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={(e) => handle(e.target.files[0])}
        disabled={busy}
      />
      <span className="muted small">Upload a shift CSV to analyze your own data.</span>
      {status && (
        <span className={status.ok ? 'ok small' : 'bad small'}>{status.msg}</span>
      )}
    </div>
  )
}
