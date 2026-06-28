import type { MiddlewareHandler } from "hono";
import jwt from "jsonwebtoken";

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  nome: string;
}

export type Env = { Variables: { user: JWTPayload } };

export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Não autorizado" }, 401);
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Token inválido ou expirado" }, 401);
  }
};

export function requireRole(...roles: string[]): MiddlewareHandler<Env> {
  return async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ error: "Acesso negado" }, 403);
    }
    await next();
  };
}
