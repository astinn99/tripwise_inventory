const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseLocalDate(value) {
  if (!value) {
    return null;
  }

  const dateTime = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (dateTime) {
    return new Date(
      Number(dateTime[1]),
      Number(dateTime[2]) - 1,
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
    );
  }

  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  return null;
}

function calendarLabel(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

export function formatFriendlyDate(value, { relative = false } = {}) {
  const date = parseLocalDate(value);
  if (!date) {
    return '';
  }

  const label = calendarLabel(date);
  if (!relative) {
    return label;
  }

  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  if (days === 0) {
    return `Today (${label})`;
  }
  if (days === 1) {
    return `Tomorrow (${label})`;
  }
  if (days === -1) {
    return `Yesterday (${label})`;
  }
  if (days > 1 && days <= 14) {
    return `In ${days} days (${label})`;
  }
  if (days < -1 && days >= -14) {
    return `${Math.abs(days)} days ago (${label})`;
  }

  return label;
}

export function formatFriendlyDateTime(value) {
  const date = parseLocalDate(value);
  if (!date) {
    return '';
  }

  const label = calendarLabel(date);
  if (!/\d{2}:\d{2}/.test(String(value))) {
    return label;
  }

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${label} at ${hours}:${minutes} ${suffix}`;
}

export function formatChartTick(value) {
  const date = parseLocalDate(value);
  if (!date) {
    return '';
  }

  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
