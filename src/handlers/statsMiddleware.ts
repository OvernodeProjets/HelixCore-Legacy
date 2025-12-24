import { NextFunction, Request, Response } from "express";
import prisma from "./prisma/prisma";
import { IUser } from "./user";

export async function trackPageView(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as IUser;

    await prisma.pageView.create({
      data: {
        path: req.path,
        userId: user?.id || null,
        userAgent: req.headers["user-agent"] || null,
        ip: req.ip,
      },
    });
  } catch (error) {
    console.error("Error tracking page view:", error);
  }
  next();
}
