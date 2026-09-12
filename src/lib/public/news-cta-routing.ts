export function resolveNewsPrimaryCtaHref(isAuthenticated: boolean) {
  return isAuthenticated ? "/app" : "/signup";
}
