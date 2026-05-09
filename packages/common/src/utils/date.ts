const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toISOString();
};

const convertToLocalDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${year}-${month}-${day} ${String(hours12).padStart(
    2,
    '0',
  )}:${minutes}:${seconds}.${milliseconds} ${ampm}`;
};

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  const remainingMilliseconds = milliseconds % 1000;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (remainingHours > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes}m`);
  }
  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }
  if (remainingMilliseconds > 0) {
    parts.push(`${remainingMilliseconds}ms`);
  }

  return parts.join(' ');
};

export { convertToLocalDate, formatDuration, formatTimestamp };
