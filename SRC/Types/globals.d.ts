export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: "ADMIN" | "PHOTOGRAPHER" | "MEMBER" | "VIEWER";
    };
  }
}
