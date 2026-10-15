/**
 * Formats an ISO date string into relative human-readable strings
 * matching the design mockup: "2 min ago", "Yesterday", "Oct 12", etc.
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 24 && now.getDate() === date.getDate()) return `${diffHours}h ago`;
  if (diffDays === 1 || (diffHours < 48 && now.getDate() - date.getDate() === 1)) return 'Yesterday';

  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}
