export const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL'];

export function normalizePriority(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'URGENT' || raw === 'HIGH') {
    return raw;
  }

  return 'NORMAL';
}

export function priorityBadgeClass(value) {
  const priority = normalizePriority(value);
  if (priority === 'URGENT') return 'badge-urgent';
  if (priority === 'HIGH') return 'badge-low-stock';
  return 'badge-priority-normal';
}

export function priorityRank(value) {
  const priority = normalizePriority(value);
  if (priority === 'URGENT') return 0;
  if (priority === 'HIGH') return 1;
  return 2;
}

export function sortByPriority(items, extraKey = 'deadline') {
  return [...items].sort((left, right) => {
    const rank = priorityRank(left.priority) - priorityRank(right.priority);
    if (rank !== 0) return rank;

    const extraA = left[extraKey] || '';
    const extraB = right[extraKey] || '';
    if (extraA && extraB && extraA !== extraB) {
      return extraA.localeCompare(extraB);
    }
    if (extraA && !extraB) return -1;
    if (!extraA && extraB) return 1;

    return String(right.id || right.poNumber || '').localeCompare(String(left.id || left.poNumber || ''));
  });
}

export function rankQuotes(quotes, priority) {
  if (!quotes.length) return [];

  const level = normalizePriority(priority);
  const maxPrice = Math.max(...quotes.map((quote) => Number(quote.totalPrice) || 0), 1);
  const maxDays = Math.max(...quotes.map((quote) => Number(quote.deliveryTimeDays) || 0), 1);

  return [...quotes].sort((left, right) => {
    if (level === 'URGENT') {
      const days = (Number(left.deliveryTimeDays) || 999) - (Number(right.deliveryTimeDays) || 999);
      if (days !== 0) return days;
      const price = (Number(left.totalPrice) || 0) - (Number(right.totalPrice) || 0);
      if (price !== 0) return price;
      return (Number(right.warrantyMonths) || 0) - (Number(left.warrantyMonths) || 0);
    }

    if (level === 'HIGH') {
      const score = (quote) => (
        ((Number(quote.deliveryTimeDays) || 0) / maxDays) + ((Number(quote.totalPrice) || 0) / maxPrice)
      );
      const diff = score(left) - score(right);
      if (diff !== 0) return diff;
      return (Number(right.warrantyMonths) || 0) - (Number(left.warrantyMonths) || 0);
    }

    const price = (Number(left.totalPrice) || 0) - (Number(right.totalPrice) || 0);
    if (price !== 0) return price;
    return (Number(left.deliveryTimeDays) || 0) - (Number(right.deliveryTimeDays) || 0);
  });
}

export function quoteRankLabel(priority) {
  const level = normalizePriority(priority);
  if (level === 'URGENT') return 'Fastest delivery';
  if (level === 'HIGH') return 'Best balance';
  return 'Best Price';
}

export function quoteWindowDays(priority) {
  const level = normalizePriority(priority);
  if (level === 'URGENT') return 2;
  if (level === 'HIGH') return 5;
  return 10;
}

export function neededInDays(priority, override) {
  const custom = Number(override);
  if (Number.isFinite(custom) && custom >= 1) {
    return Math.min(Math.floor(custom), 90);
  }

  const level = normalizePriority(priority);
  if (level === 'URGENT') return 3;
  if (level === 'HIGH') return 7;
  return 14;
}

export function preferredMaxDeliveryDays(priority, override) {
  return neededInDays(priority, override);
}
