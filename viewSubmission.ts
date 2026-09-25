import { supabase } from './supabaseClient'

// چون باکت submissions خصوصیه، برای دیدن فایل باید یه لینک موقت امن بسازیم
export async function getSignedFileUrl(path: string): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, 60 * 5)
  if (error || !data?.signedUrl) {
    console.error(error)
    return null
  }
  return data.signedUrl
}
