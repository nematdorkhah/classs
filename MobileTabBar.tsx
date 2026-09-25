interface TabItem {
  id: string
  label: string
  icon: string
  badge?: number | string
}

export default function MobileTabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
}) {
  return (
    <nav
      className="mobile-tab-bar"
      aria-label="ناوبری اصلی برنامه"
    >
      <div className="mobile-tab-container">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                onChange(tab.id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <div className="tab-icon-wrap">
                <span className="tab-icon">{tab.icon}</span>
                {Boolean(tab.badge) && <span className="tab-badge">{tab.badge}</span>}
              </div>
              <span className="tab-label">{tab.label}</span>
              {isActive && <div className="tab-indicator" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
