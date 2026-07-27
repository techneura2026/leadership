export function getAppLoginUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://leaderprism-dev-app.centralus.cloudapp.azure.com/login';
  }
  return 'http://localhost:3000/login';
}
