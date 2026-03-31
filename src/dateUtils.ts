export const formatDate = (timestamp?: number, withYear = false): string => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    ...(withYear ? { year: 'numeric' } : {}),
  });
};

export const formatDateTime = (timestamp?: number): string => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isOverdue = (dueDate?: number): boolean => {
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDateObj = new Date(dueDate);
  dueDateObj.setHours(0, 0, 0, 0);

  return dueDateObj.getTime() < today.getTime();
};

