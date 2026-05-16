import { GA_MEASUREMENT_ID } from '../config.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function shouldTrack() {
  if (!GA_MEASUREMENT_ID || typeof GA_MEASUREMENT_ID !== 'string') return false;
  if (LOCAL_HOSTS.has(location.hostname)) return false;
  return true;
}

function initAnalytics() {
  if (!shouldTrack()) return;

  const id = GA_MEASUREMENT_ID;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

initAnalytics();
