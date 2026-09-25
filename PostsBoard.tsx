import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { isItemExpiredForStudent } from '../utils/expiration'
import { toPersianDigits } from '../utils/persianNumbers'
import MathRenderer from './MathRenderer'
import AttachmentViewerModal from './AttachmentViewerModal'

export default function PostsBoard({
  posts,
  emptyText,
  teacherPassword,
  onChanged,
}: {
  posts: any[]
  emptyText?: string
  teacherPassword?: string
  onChanged?: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [viewerAttachment, setViewerAttachment] = useState<{ url: string; title: string } | null>(null)

  function startEdit(p: any) {
    setEditingId(p.id)
    setTitleDraft(p.title)
    setBodyDraft(p.body || '')
    setExpandedPostId(p.id)
  }

  async function saveEdit(postId: string) {
    if (!teacherPassword) {
      alert('رمز عبور آموزگار یافت نشد.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('teacher_update_post', {
        p_password: teacherPassword,
        p_post_id: postId,
        p_title: titleDraft,
        p_body: bodyDraft,
      })
      if (error) {
        // Fallback direct update
        await supabase.from('posts').update({ title: titleDraft, body: bodyDraft }).eq('id', postId)
      }
      setEditingId(null)
      if (onChanged) onChanged()
    } catch (err: any) {
      alert('خطا در ذخیره تغییرات: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(postId: string, postTitle: string) {
    if (!teacherPassword) {
      alert('رمز عبور آموزگار در نشست فعلی ثبت نشده است. لطفاً یک‌بار از پنل خارج و مجدداً وارد شوید.')
      return
    }
    if (!confirm(`آیا از حذف پست «${postTitle || 'بدون عنوان'}» و کلیه پاسخ‌های ارسالی آن مطمئن هستید؟`)) {
      return
    }

    setDeletingId(postId)
    try {
      let deleted = false

      // 1. First call server-side delete endpoint
      try {
        const res = await fetch('/api/teacher/delete-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherPassword, postId }),
        })
        const data = await res.json()
        if (data && data.success) {
          deleted = true
        }
      } catch (errServer) {
        console.warn('Server delete endpoint error:', errServer)
      }

      // 2. Direct client-side fallbacks if server wasn't reachable
      if (!deleted) {
        try {
          await supabase.from('submissions').delete().eq('post_id', postId)
        } catch (e) {
          // ignore
        }

        const rpcResult = await supabase.rpc('teacher_delete_post', {
          p_password: teacherPassword,
          p_post_id: postId,
        })

        if (rpcResult.error) {
          const directResult = await supabase.from('posts').delete().eq('id', postId)
          if (directResult.error) {
            throw new Error(directResult.error.message || rpcResult.error.message)
          }
        }
      }

      // 3. Immediately refresh page state
      if (expandedPostId === postId) setExpandedPostId(null)
      if (editingId === postId) setEditingId(null)
      if (onChanged) onChanged()
    } catch (err: any) {
      console.error('Delete post failed:', err)
      alert('خطا در حذف تکلیف: ' + (err?.message || 'مشکل در برقراری ارتباط'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="board hard">
      {posts.length === 0 && (
        <div className="post">
          <div className="body">
            <p>{emptyText || 'هنوز پستی در این بخش ثبت نشده است.'}</p>
          </div>
        </div>
      )}
      {posts.map((p) => {
        const isExpired = isItemExpiredForStudent(p, 5)
        const isDeleting = deletingId === p.id
        const isExpanded = expandedPostId === p.id || editingId === p.id

        return (
          <div
            className="post hard"
            key={p.id}
            style={{
              transition: 'all 0.2s ease',
              border: isExpanded ? '2px solid #2563EB' : '2px solid #0F172A',
              background: isExpanded ? '#FFFFFF' : '#FAFAFA',
              borderRadius: 14,
              marginBottom: 10,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isExpanded ? '0 6px 18px rgba(37,99,235,0.08)' : '0 2px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Accordion Compact Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => {
                if (editingId === p.id) return
                setExpandedPostId(isExpanded ? null : p.id)
              }}
            >
              {/* Right Side: Icon & Title & Tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 8,
                    background: p.type === 'homework' ? '#FEF3C7' : '#E0E7FF',
                    color: p.type === 'homework' ? '#B45309' : '#3730A3',
                    border: '1px solid',
                    borderColor: p.type === 'homework' ? '#FDE68A' : '#C7D2FE',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {p.type === 'homework' ? '📐 تکلیف' : '📣 اعلان'}
                </span>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 900,
                    color: isExpanded ? '#1D4ED8' : '#0F172A',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: isExpanded ? 'normal' : 'nowrap',
                  }}
                >
                  {toPersianDigits(p.title)}
                </h3>

                {p.due_at && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748B',
                      background: '#F1F5F9',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    ⏰ {toPersianDigits(new Date(p.due_at).toLocaleDateString('fa-IR'))}
                  </span>
                )}

                {teacherPassword && isExpired && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#FEE2E2',
                      color: '#991B1B',
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid #FCA5A5',
                    }}
                  >
                    ⏳ منقضی شده
                  </span>
                )}
              </div>

              {/* Left Side: Actions (Edit / Delete) & Chevron */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {teacherPassword && editingId !== p.id && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="upload-btn"
                      type="button"
                      title="ویرایش تکلیف"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(p)
                      }}
                      style={{ padding: '5px 8px', fontSize: 13 }}
                    >
                      ✏️
                    </button>
                    <button
                      className="upload-btn"
                      type="button"
                      title="حذف تکلیف"
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(p.id, p.title)
                      }}
                      style={{
                        color: '#DC2626',
                        opacity: isDeleting ? 0.5 : 1,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        padding: '5px 8px',
                        fontSize: 13,
                        borderColor: '#FECACA',
                        background: '#FEF2F2',
                      }}
                    >
                      {isDeleting ? '⏳' : '🗑'}
                    </button>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: isExpanded ? '#2563EB' : '#64748B',
                    background: isExpanded ? '#EFF6FF' : '#F1F5F9',
                    padding: '4px 10px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{isExpanded ? 'بستن' : 'مشاهده'}</span>
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
            </div>

            {/* Collapsed short excerpt preview */}
            {!isExpanded && p.body && (
              <div
                style={{
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: '#64748B',
                  marginTop: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: 4,
                }}
                onClick={() => setExpandedPostId(p.id)}
              >
                {p.body.slice(0, 95)}...
              </div>
            )}

            {/* Accordion Expanded Content */}
            {isExpanded && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1.5px dashed #CBD5E1',
                }}
              >
                {editingId === p.id ? (
                  <div>
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '2px solid var(--black)',
                        marginBottom: 8,
                        fontWeight: 800,
                      }}
                    />
                    <textarea
                      value={bodyDraft}
                      onChange={(e) => setBodyDraft(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 120,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '2px solid var(--black)',
                        fontFamily: 'inherit',
                        fontSize: 13.5,
                        lineHeight: 1.8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className="upload-btn"
                        type="button"
                        disabled={saving}
                        onClick={() => saveEdit(p.id)}
                      >
                        {saving ? 'در حال ذخیره...' : 'ذخیره'}
                      </button>
                      <button
                        className="link"
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {p.body && (
                      <div className="post-formatted-body">
                        <MathRenderer text={p.body} />
                      </div>
                    )}

                    {p.due_at && (
                      <div className="meta" style={{ marginTop: 10, color: '#334155', fontWeight: 700 }}>
                        ⏰ مهلت تحویل: {toPersianDigits(new Date(p.due_at).toLocaleString('fa-IR'))}
                      </div>
                    )}

                    {p.attachment_path && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="upload-btn"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewerAttachment({
                              url: p.attachment_path,
                              title: p.title || 'پیوست تکلیف',
                            })
                          }}
                        >
                          📎 مشاهده، زوم و دانلود فایل پیوست تکلیف
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {viewerAttachment && (
        <AttachmentViewerModal
          url={viewerAttachment.url}
          title={viewerAttachment.title}
          onClose={() => setViewerAttachment(null)}
        />
      )}
    </div>
  )
}
