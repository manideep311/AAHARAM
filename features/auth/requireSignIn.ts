import { router } from "expo-router";
import { useAuthStore } from "../../store/auth-store";

// Gate for account-only actions (checkout, favorites, addresses). Guests are sent to login
// and brought back to `returnTo` after signing in; the device-local cart survives untouched.
export function requireSignIn(returnTo: string): boolean {
  const user = useAuthStore.getState().user;
  if (user && !user.isGuest) return true;
  router.push(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  return false;
}
