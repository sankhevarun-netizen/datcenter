'use client';
// Performance monitoring: Core Web Vitals for every page view, sent to the
// telemetry endpoint. Sampled to keep the volume small.
import { useReportWebVitals } from 'next/web-vitals';

const SAMPLE = 0.25;

export default function WebVitals() {
  useReportWebVitals((metric) => {
    // Presentation cockpits make no network requests at all.
    if (window.location.pathname.startsWith('/cockpit') || document.body.dataset.presenting) return;
    if (Math.random() > SAMPLE) return;
    const body = JSON.stringify({ type: 'web_vital', name: metric.name, value: Math.round(metric.value * 100) / 100, path: window.location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
    else fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  });
  return null;
}
