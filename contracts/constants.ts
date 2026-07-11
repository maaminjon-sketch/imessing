export const Session = {
  cookieName: "imessing_token",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
  usernameTaken: "Username already taken",
  invalidCredentials: "Invalid username or password",
  userNotFound: "User not found",
  chatNotFound: "Chat not found",
} as const;

export const Paths = {
  login: "/login",
  register: "/register",
} as const;
