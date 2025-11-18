// Main admin Telegram IDs - hardcoded for security
export const ADMIN_TELEGRAM_IDS = ['785921635'];

export const isMainAdmin = (telegramId: string | number): boolean => {
  return ADMIN_TELEGRAM_IDS.includes(String(telegramId));
};
