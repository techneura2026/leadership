export function getAppLoginUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://leaderprism.187-127-182-104.sslip.io/login';
  }
  return 'http://localhost:3000/login';
}
