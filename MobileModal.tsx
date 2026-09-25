import { useEffect } from 'react'

export default function MobileModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="mobile-modal-overlay" onClick={onClose}>
      <div
        className="mobile-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Grab Handle */}
        <div className="mobile-modal-handle" />

        {/* Modal Header */}
        <div className="mobile-modal-header">
          <div>
            <h3 className="mobile-modal-title">{title}</h3>
            {subtitle && <p className="mobile-modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="mobile-modal-close"
            onClick={onClose}
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="mobile-modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
