import { createClient } from '@supabase/supabase-js'
import { EVENTS, rawBody, verifySignature } from '../../../lib/mail-events.mjs'

// What the mail provider tells us afterwards: delivered, bounced, complained, delayed.
//
// This endpoint exists because of a specific failure. Eight invitations went out and one candidate
// answered, and the school had no way to tell the difference between seven people ignoring them and
// seven emails that never arrived -- those call for opposite responses. Handing a message to the
// provider is not delivery, and the only party who knows the difference is the provider. So it
// tells us, and we write it down next to the send.
//
// A bounce in particular has to be visible. Two of that first batch were Indeed relay addresses,
// which reject or silently drop mail from outside Indeed; chasing those candidates by email again
// would have been a week spent writing to a wall.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
 if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' })

 const secret = process.env.RESEND_WEBHOOK_SECRET
 if (!secret) return res.status(503).json({ error: 'Not configured.' })

 const body = (await rawBody(req)).toString('utf8')
 const ok = verifySignature({
  secret, body,
  id: req.headers['svix-id'],
  timestamp: req.headers['svix-timestamp'],
  header: req.headers['svix-signature'],
 })
 // Unsigned or stale: refused without explanation. Anything reaching this URL that cannot sign is
 // either a mistake or someone writing delivery reports into a hiring record.
 if (!ok) return res.status(401).json({ error: 'Bad signature.' })

 let event
 try { event = JSON.parse(body) } catch { return res.status(400).json({ error: 'Bad body.' }) }

 const delivery = EVENTS[event?.type]
 const providerId = event?.data?.email_id || event?.data?.id
 // An event we do not track, or one we cannot tie to a send, is accepted and dropped. Returning an
 // error would make the provider retry it forever.
 if (!delivery || !providerId) return res.status(200).json({ ignored: true })

 const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
 })

 const detail = String(
  event?.data?.bounce?.message || event?.data?.bounce?.subType || event?.data?.reason || '',
 ).slice(0, 500) || null

 const { error } = await db.from('ap_hiring_invite_sends')
  .update({ delivery, delivery_detail: detail, delivery_at: event?.created_at || new Date().toISOString() })
  .eq('provider_id', providerId)
 if (error) {
  console.error('Could not record a mail delivery event', { name: error.name })
  return res.status(500).json({ error: 'Could not record it.' })
 }
 return res.status(200).json({ recorded: delivery })
}
