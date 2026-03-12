import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://cdobxcexgwomqxryhzqw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkb2J4Y2V4Z3dvbXF4cnloenF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDI3NTIsImV4cCI6MjA4ODkxODc1Mn0.Cv81mlP-Xg7_zXCgyso_BIDAc_KibzLZulRElWZmcME'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
