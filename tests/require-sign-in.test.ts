jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { router } from "expo-router";
import { requireSignIn } from "../features/auth/requireSignIn";
import { useAuthStore } from "../store/auth-store";

const push = router.push as jest.Mock;

beforeEach(() => push.mockClear());

describe("requireSignIn", () => {
  it("lets signed-in users through without navigating", () => {
    useAuthStore.setState({ user: { id: "u1", name: "Asha", email: "a@example.com", isGuest: false } });
    expect(requireSignIn("/checkout")).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("sends guests to login with an encoded returnTo", () => {
    useAuthStore.setState({ user: { id: "guest", name: "Guest", isGuest: true } });
    expect(requireSignIn("/checkout")).toBe(false);
    expect(push).toHaveBeenCalledWith("/auth/login?returnTo=%2Fcheckout");
  });

  it("treats a missing user like a guest", () => {
    useAuthStore.setState({ user: null });
    expect(requireSignIn("/addresses")).toBe(false);
    expect(push).toHaveBeenCalledWith("/auth/login?returnTo=%2Faddresses");
  });
});
