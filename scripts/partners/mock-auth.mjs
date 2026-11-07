let session = null;
export function setSession(value) {
  session = value;
}
export async function auth() {
  return session;
}
