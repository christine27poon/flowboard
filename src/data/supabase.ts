import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until .env.local has both values; App shows a setup message instead of the board. */
export const isSupabaseConfigured = Boolean(url && key)

// createClient throws on empty values, so unconfigured builds get placeholders that are never used.
export const supabase = createClient<Database>(url || 'http://localhost', key || 'unconfigured')
