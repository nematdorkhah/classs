import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { todayISO } from '../useJalaliDate'

export function useClassroomData(teacherPassword: string) {
  const [students, setStudents] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [attendanceToday, setAttendanceToday] = useState<Record<string, string>>({})
  const [allAttendance, setAllAttendance] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const hasLoadedOnce = useRef(false)

  const loadAll = useCallback(async () => {
    if (!teacherPassword) return
    if (!hasLoadedOnce.current) setLoading(true)
    const [s, p, sub, allAtt, g] = await Promise.all([
      supabase.rpc('teacher_list_students', { p_password: teacherPassword }),
      supabase.rpc('teacher_list_posts', { p_password: teacherPassword }),
      supabase.rpc('teacher_list_submissions', { p_password: teacherPassword }),
      supabase.rpc('teacher_list_attendance', { p_password: teacherPassword }),
      supabase.rpc('teacher_list_grades', { p_password: teacherPassword }),
    ])
    setStudents(s.data || [])
    setPosts(p.data || [])
    setSubmissions(sub.data || [])
    const todayStr = todayISO()
    const attMap: Record<string, string> = {}
    ;(allAtt.data || []).forEach((a: any) => {
      if (a.date === todayStr) attMap[a.student_id] = a.status
    })
    setAttendanceToday(attMap)
    setAllAttendance(allAtt.data || [])
    setGrades(g.data || [])
    hasLoadedOnce.current = true
    setLoading(false)
  }, [teacherPassword])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return {
    students,
    posts,
    submissions,
    attendanceToday,
    allAttendance,
    grades,
    loading,
    reload: loadAll,
  }
}
