export function formatDisplayDate(value) {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]}/${match[1]}`;
  }

  return String(value);
}
