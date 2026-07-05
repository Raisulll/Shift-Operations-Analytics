import { useRef, useState } from 'react'
import { api } from '../api'

// Upload any shift CSV; on success the whole dashboard refreshes against it.
// The "currently loaded" indicator lives in the header (App), so here we only
// surface upload errors.
export default function UploadCard({ onUploaded }) {
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.upload(file)
      onUploaded(res.summary, file.name)
    } catch (e) {
      setError(e.message)
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
        accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.json"
        onChange={(e) => handle(e.target.files[0])}
        disabled={busy}
      />
      <span className="muted small">Upload CSV, Excel or JSON to analyze your own data.</span>
      {error && <span className="bad small">{error}</span>}
    </div>
  )
}
