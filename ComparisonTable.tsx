import { useMemo, useState } from 'react'

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'right',
  fontWeight: 800,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

export default function ComparisonTable({
  statsRows,
  onSelectStudent,
  selectedStudentId,
}: {
  statsRows: any[]
  onSelectStudent: (id: string | null) => void
  selectedStudentId?: string | null
}) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedRows = useMemo(() => {
    const rows = [...statsRows]
    rows.sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (av === null) av = -1
      if (bv === null) bv = -1
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [statsRows, sortKey, sortDir])

  function sortBy(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function arrow(key: string) {
    return sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''
  }

  return (
    <>
      <div className="form-panel hard" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--cream-2)' }}>
              <th style={thStyle} onClick={() => sortBy('name')}>نام {arrow('name')}</th>
              <th style={thStyle} onClick={() => sortBy('avg')}>میانگین {arrow('avg')}</th>
              <th style={thStyle} onClick={() => sortBy('submitted')}>تکالیف ارسالی {arrow('submitted')}</th>
              <th style={thStyle} onClick={() => sortBy('streak')}>پیوستگی {arrow('streak')}</th>
              <th style={thStyle} onClick={() => sortBy('present')}>حاضر {arrow('present')}</th>
              <th style={thStyle} onClick={() => sortBy('late')}>تاخیر {arrow('late')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  borderTop: '2px solid var(--black)',
                  cursor: 'pointer',
                  background: selectedStudentId === r.id ? 'var(--cream-2)' : 'transparent',
                }}
                onClick={() => onSelectStudent(selectedStudentId === r.id ? null : r.id)}
              >
                <td style={tdStyle}>{i + 1}. {r.name}</td>
                <td style={tdStyle}>{r.avg !== null ? r.avg.toFixed(1) : '—'}</td>
                <td style={tdStyle}>{r.submitted}/{r.totalHomework}</td>
                <td style={tdStyle}>{r.streak > 0 ? `🔥 ${r.streak}` : '—'}</td>
                <td style={tdStyle}>{r.present}</td>
                <td style={tdStyle}>{r.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: '#8a8378', marginTop: 8 }}>
        روی سرستون‌ها بزن تا مرتب بشه؛ روی خود یه دانش‌آموز بزن تا پروفایل کاملش باز بشه.
      </p>
    </>
  )
}
