import { getClient, initSupabase } from './sync-service.js';

const APP_VERSION = '20260522';
const MESSAGE_MAX = 2000;

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Insert a feedback row for the signed-in user. The DB fills in user_id from
 * the authenticated session (default auth.uid()), so the client never sends it.
 * @param {{ message: string, recommend: boolean|null, shareEmail: boolean, email: string|null }} input
 */
export async function submitFeedback({ message, recommend, shareEmail, email }) {
  let client = getClient();
  if (!client) client = initSupabase();
  if (!client) throw new Error('Could not connect. Please try again.');

  const cleanMessage = clip(message, MESSAGE_MAX);
  if (!cleanMessage) throw new Error('Please write a short message before sending.');

  const row = {
    message: cleanMessage,
    recommend: typeof recommend === 'boolean' ? recommend : null,
    share_email: !!shareEmail,
    email: shareEmail && email ? email : null,
    app_version: APP_VERSION,
    user_agent: clip(navigator.userAgent || '', 500),
  };

  const { error } = await client.from('feedback').insert(row);
  if (error) {
    throw new Error(error.message || 'Could not send feedback. Please try again.');
  }
}
