import { useState } from 'react'

export default function FileViewerModal({
  url,
  fileName,
  onClose,
}: {
  url: string
  fileName?: string
  onClose: () => void
}) {
  const [fullscreen, setFullscreen] = useState(false)
  const isPdf = /\.pdf($|\?)/i.test(url)

  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div className={`viewer-box ${fullscreen ? 'fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="viewer-toolbar">
          <a href={url} download={fileName} target="_blank" rel="noreferrer">⬇️ دانلود</a>
          <button type="button" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? '⤢ خروج از تمام‌صفحه' : '⤢ تمام‌صفحه'}
          </button>
          <button type="button" onClick={onClose}>✕ بستن</button>
        </div>
        <div className="viewer-content">
          {isPdf ? <iframe src={url} title={fileName || 'file'} /> : <img src={url} alt={fileName || 'file'} />}
        </div>
      </div>
    </div>
  )
}
