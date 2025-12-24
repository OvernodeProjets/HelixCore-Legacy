import { NextFunction, Request, Response } from "express";
import { IUser } from "./user";

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    console.log("User not authenticated, redirecting to /");
    return res.redirect("/");
  }

  const user = req.user as IUser;
  console.log("User admin status:", user?.admin);

  if (!user?.admin) {
    console.log("User not admin, redirecting to /dashboard");
    return res.redirect("/dashboard");
  }

  console.log("User is admin, proceeding");
  next();
}

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}
