import { supabase } from './supabase';

// Bucket "logos" bersifat privat, jadi URL yang tersimpan di dealer_settings tidak bisa dibuka langsung.
// Ambil nama filenya lalu minta URL bertanda tangan yang hanya berlaku sebentar (perlu login + izin RLS).
export async function getLogosSignedUrl(storedUrl) {
  if (!storedUrl) return null;

  const path = decodeURIComponent(storedUrl.split('/logos/').pop().split('?')[0]);
  const { data, error } = await supabase.storage.from('logos').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return null;

  return data.signedUrl;
}
