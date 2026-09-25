import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'

interface AttachmentViewerModalProps {
  url: string
  title?: string
  onClose: () => void
}

export default function AttachmentViewerModal({
  url,
  title = 'فایل پیوست',
  onClose,
}: AttachmentViewerModalProps) {
  const [zoom, setZoom] = useState(1)
  const [imgError, setImgError] = useState(false)

  // Resolve URL if it's a relative Supabase storage path
  const resolvedUrl = useMemo(() => {
    if (!url) return ''
    const trimmed = url.trim()
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed
    }
    // Try materials bucket first, fallback to submissions bucket
    try {
      const { data: matData } = supabase.storage.from('materials').getPublicUrl(trimmed)
      if (matData?.publicUrl) return matData.publicUrl
    } catch {}
    try {
      const { data: subData } = supabase.storage.from('submissions').getPublicUrl(trimmed)
      if (subData?.publicUrl) return subData.publicUrl
    } catch {}
    return trimmed
  }, [url])

  if (!resolvedUrl) return null

  // Check file types (case-insensitive)
  const cleanUrl = resolvedUrl.split('?')[0].toLowerCase()
  const isImage =
    /\.(jpeg|jpg|png|gif|webp|svg|bmp|jfif)$/i.test(cleanUrl) ||
    resolvedUrl.startsWith('data:image/') ||
    !cleanUrl.includes('.') // Default unknown to image attempt
  const isPdf = /\.pdf$/i.test(cleanUrl) || resolvedUrl.startsWith('data:application/pdf')
  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(cleanUrl) || resolvedUrl.startsWith('data:video/')
  const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(cleanUrl) || resolvedUrl.startsWith('data:audio/')

  function handleZoomIn() {
    setZoom((prev) => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100))
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(0.5, Math.round((prev - 0.25) * 100) / 100))
  }

  function handleResetZoom() {
    setZoom(1)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        direction: 'rtl',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          width: '100%',
          maxWidth: 950,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          border: '3px solid #0F172A',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            padding: '12px 18px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>
              {isImage ? '🖼️' : isPdf ? '📄' : isVideo ? '🎬' : isAudio ? '🎵' : '📎'}
            </span>
            <span
              style={{
                fontWeight: 900,
                fontSize: 15,
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', flexShrink: 0 }}>
            {/* Top Close Button (Prominent Red) */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                width: 36,
                height: 36,
                borderRadius: '50%',
                fontSize: 18,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease',
              }}
              title="بستن پنجره (Esc)"
            >
              ✕
            </button>

            {/* Direct Download */}
            <a
              href={resolvedUrl}
              download={title || 'attachment'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '7px 14px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              📥 دانلود
            </a>

            {/* Open in New Tab Link */}
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '7px 12px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 12.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
              title="باز کردن در صفحه جداگانه"
            >
              ↗️ تب جدید
            </a>

            {/* Zoom Controls for Images */}
            {isImage && !imgError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 10,
                  padding: '2px 4px',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    width: 28,
                    height: 28,
                    cursor: zoom > 0.5 ? 'pointer' : 'default',
                    fontSize: 18,
                    fontWeight: 900,
                    opacity: zoom <= 0.5 ? 0.4 : 1,
                  }}
                  title="کوچک‌نمایی"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FACC15',
                    fontSize: 12,
                    fontWeight: 900,
                    padding: '0 6px',
                    cursor: 'pointer',
                  }}
                  title="بزرگنمایی استاندارد (۱۰۰٪)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3.5}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    width: 28,
                    height: 28,
                    cursor: zoom < 3.5 ? 'pointer' : 'default',
                    fontSize: 18,
                    fontWeight: 900,
                    opacity: zoom >= 3.5 ? 0.4 : 1,
                  }}
                  title="بزرگ‌نمایی"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Content Viewer Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            minHeight: 340,
            maxHeight: 'calc(94vh - 65px)',
          }}
        >
          {isImage && !imgError ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                overflow: 'auto',
                padding: 10,
              }}
            >
              <img
                src={resolvedUrl}
                alt={title}
                onError={() => setImgError(true)}
                style={{
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  maxHeight: zoom <= 1 ? '74vh' : 'none',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : isPdf ? (
            <div style={{ width: '100%', height: '75vh' }}>
              <iframe
                src={`${resolvedUrl}#toolbar=1&navpanes=0`}
                title={title}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: 10,
                  background: '#FFFFFF',
                }}
              />
            </div>
          ) : isVideo ? (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <video
                controls
                src={resolvedUrl}
                style={{
                  maxWidth: '100%',
                  maxHeight: '74vh',
                  borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          ) : isAudio ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#FFFFFF', borderRadius: 16, border: '2px solid #E2E8F0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 800 }}>پخش فایل صوتی</h4>
              <audio controls src={resolvedUrl} style={{ width: '100%', maxWidth: 450 }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, background: '#FFFFFF', borderRadius: 16, border: '2px solid #E2E8F0', maxWidth: 480 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div>
              <h4 style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
                {title || 'فایل ضمیمه'}
              </h4>
              <p style={{ fontWeight: 600, color: '#64748B', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
                پیش‌نمایش این فایل درون مرورگر میسر نیست یا لینک دانلود در دسترس می‌باشد. می‌توانید مستقیماً فایل را دریافت کنید یا در پنجره جداگانه باز نمایید.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <a
                  href={resolvedUrl}
                  download={title || 'attachment'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ display: 'inline-flex', width: 'auto', padding: '10px 20px', fontSize: 14 }}
                >
                  📥 دانلود مستقیم فایل
                </a>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn secondary"
                  style={{ display: 'inline-flex', width: 'auto', padding: '10px 20px', fontSize: 14 }}
                >
                  ↗️ باز کردن در تب جدید
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
