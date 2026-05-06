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
  const milliseconds = String(date.getMilliseconds()).padStart(
    MILLISECONDS_PADDING_DIGITS,
    '0'
  );
  const ampm = hours24 >= NOON_HOUR ? 'PM' : 'AM';
  const hours12 = hours24 % NOON_HOUR || NOON_HOUR;

  return `${year}-${month}-${day} ${String(hours12).padStart(
    2,
    '0'
  )}:${minutes}:${seconds}.${milliseconds} ${ampm}`;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const NOON_HOUR = 12;
const MILLISECONDS_PADDING_DIGITS = 3;

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const days = Math.floor(hours / HOURS_PER_DAY);

  const remainingHours = hours % HOURS_PER_DAY;
  const remainingMinutes = minutes % SECONDS_PER_MINUTE;
  const remainingSeconds = seconds % SECONDS_PER_MINUTE;
  const remainingMilliseconds = milliseconds % MILLISECONDS_PER_SECOND;

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
