import { createClient } from '@supabase/supabase-js'

// GANTI INI DENGAN URL SUPABASE ANDA
const supabaseUrl = 'https://ygqdpsmifqnmjfhircry.supabase.co'
// GANTI INI DENGAN ANON KEY SUPABASE ANDA
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWRwc21pZnFubWpmaGlyY3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjI0MjQsImV4cCI6MjA5MTc5ODQyNH0.hX-ROFh_pwUDPbsj96iXPy4xoWIXooZaZG0CsiDxIBw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)