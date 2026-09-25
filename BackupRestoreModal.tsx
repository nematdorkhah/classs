import { useState } from 'react'
import {
  exportCompleteSystemBackup,
  downloadBackupFile,
  restoreSystemBackup,
} from '../utils/examStore'

export default function BackupRestoreModal({
  teacherPassword,
  onClose,
  onRestored,
}: {
  teacherPassword: string
  onClose: () => void
  onRestored?: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleExport() {
    setDownloading(true)
    setStatusMsg('')
    try {
      const json = await exportCompleteSystemBackup(teacherPassword)
      downloadBackupFile(json)
      setStatusMsg('فایل پشتیبان کامل با موفقیت دانلود شد ✓')
      setIsSuccess(true)
    } catch (err: any) {
      setStatusMsg('خطا در دانلود پشتیبان: ' + err.message)
      setIsSuccess(false)
    } finally {
      setDownloading(false)
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    setStatusMsg('')

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const res = await restoreSystemBackup(text)
        setStatusMsg(res.message)
        setIsSuccess(res.success)
        if (res.success && onRestored) {
          onRestored()
        }
      } catch (err: any) {
        setStatusMsg('خطا در خواندن فایل: ' + err.message)
        setIsSuccess(false)
      } finally {
        setRestoring(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0' }}>
        برای اطمینان از حفظ تمام اطلاعات کلاس (آزمون‌ها، سوالات، پاسخ‌های دانش‌آموزان، نمرات و تکالیف)، می‌توانید فایل پشتیبان کامل را دانلود کرده و در صورت نیاز در آینده آن را بازیابی نمایید.
      </p>

      {/* Export Section */}
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: '#F8FAFC',
          border: '1.5px solid #CBD5E1',
          marginBottom: 16,
        }}
      >
        <h4 style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
          📥 ۱. دانلود فایل پشتیبان کامل (JSON)
        </h4>
        <p style={{ fontSize: 12.5, color: '#64748B', margin: '0 0 12px 0' }}>
          یک فایل متنی کامل حاوی کلیه سوابق آزمون‌ها، پاسخ‌نامه‌ها و نمرات در رایانه شما ذخیره می‌شود.
        </p>

        <button
          type="button"
          className="btn"
          disabled={downloading}
          onClick={handleExport}
          style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}
        >
          {downloading ? 'در حال تهیه پشتیبان...' : '💾 دانلود فایل پشتیبان کلیه اطلاعات'}
        </button>
      </div>

      {/* Restore Section */}
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: '#F0FDF4',
          border: '1.5px solid #86EFAC',
          marginBottom: 16,
        }}
      >
        <h4 style={{ fontSize: 15, fontWeight: 900, color: '#166534', margin: '0 0 6px 0' }}>
          📤 ۲. بازیابی اطلاعات از فایل پشتیبان
        </h4>
        <p style={{ fontSize: 12.5, color: '#334155', margin: '0 0 12px 0' }}>
          اگر برنامه را دوباره ساخته‌اید، فایل پشتیبان قبلی را انتخاب کنید تا کلیه داده‌ها بازگردانی شوند.
        </p>

        <label
          className="btn"
          style={{
            display: 'block',
            textAlign: 'center',
            background: '#10B981',
            padding: '10px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {restoring ? 'در حال بازیابی اطلاعات...' : '📂 انتخاب فایل پشتیبان جهت بازیابی'}
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileSelected} />
        </label>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 16,
            background: isSuccess ? '#DCFCE7' : '#FEE2E2',
            color: isSuccess ? '#166534' : '#DC2626',
            border: `1px solid ${isSuccess ? '#86EFAC' : '#FCA5A5'}`,
          }}
        >
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn secondary" onClick={onClose}>
          بستن
        </button>
      </div>
    </div>
  )
}
