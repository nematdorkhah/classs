import SchoolLogo from './SchoolLogo'

export default function MobileHeader({
  title,
  subtitle,
  userBadge,
  dateLabel,
  onLogout,
  onAction,
  actionLabel,
  actionIcon,
}: {
  title: string
  subtitle?: string
  userBadge?: string
  dateLabel?: string
  onLogout?: () => void
  onAction?: () => void
  actionLabel?: string
  actionIcon?: string
}) {
  return (
    <header className="mobile-app-header">
      <div className="mobile-header-inner">
        {/* Right side: School badge & title */}
        <div className="mobile-header-brand">
          <div className="mobile-brand-icon" style={{ padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SchoolLogo size={34} />
          </div>
          <div className="mobile-brand-text">
            <h1 className="mobile-brand-title">{title}</h1>
            {subtitle && <span className="mobile-brand-subtitle">{subtitle}</span>}
          </div>
        </div>

        {/* Left side: Date / User badge / Actions */}
        <div className="mobile-header-actions">
          {userBadge && (
            <span className="mobile-user-tag">{userBadge}</span>
          )}

          {dateLabel && (
            <span className="mobile-date-tag">{dateLabel}</span>
          )}

          {onAction && (
            <button
              type="button"
              className="mobile-header-btn"
              onClick={onAction}
              title={actionLabel}
            >
              {actionIcon || '⚙️'}
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              className="mobile-header-btn logout"
              onClick={onLogout}
              title="خروج از حساب"
            >
              🚪
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
