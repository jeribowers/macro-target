import { getClient, initSupabase } from './sync-service.js';

const APP_VERSION = '20260522';
const MESSAGE_MAX = 1000;

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Insert a feedback row for the signed-in user. The DB fills in user_id and,
 * when requested, email from the authenticated session.
 * @param {{ message: string, recommend: boolean|null, shareEmail: boolean }} input
 */
export async function submitFeedback({ message, recommend, shareEmail }) {
  let client = getClient();
  if (!client) client = initSupabase();
  if (!client) throw new Error('Could not connect. Please try again.');

  const cleanMessage = clip(message, MESSAGE_MAX);
  if (!cleanMessage) throw new Error('Please write a short message before sending.');

  const row = {
    message: cleanMessage,
    recommend: typeof recommend === 'boolean' ? recommend : null,
    share_email: !!shareEmail,
    app_version: APP_VERSION,
    user_agent: clip(navigator.userAgent || '', 500),
  };

  const { error } = await client.from('feedback').insert(row);
  if (error) {
    const errorMessage = error.message || '';
    if (errorMessage.includes('You can send up to 2 feedback messages per day')) {
      throw new Error('You can send up to 2 feedback messages per day. Please try again tomorrow.');
    }
    throw new Error('Could not send feedback. Please try again.');
  }
}
