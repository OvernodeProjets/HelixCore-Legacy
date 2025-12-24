import { SessionData, Store } from "express-session";
import prisma from "./prisma";

interface SessionOptions {
  ttl?: number;
  cleanupInterval?: number;
}

export default class PrismaStore extends Store {
  private ttl: number;
  private cleanupInterval!: NodeJS.Timeout;

  constructor(options: SessionOptions = {}) {
    super();
    this.ttl = options.ttl || 86400000;

    if (options.cleanupInterval !== 0) {
      const cleanupIntervalMs = options.cleanupInterval || 3600000;
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        cleanupIntervalMs
      );
      if (this.cleanupInterval.unref) this.cleanupInterval.unref();
    }
  }

  async get(
    sid: string,
    callback: (err: any, session?: SessionData | null) => void
  ): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { sid },
      });

      if (!session) {
        return callback(null, null);
      }

      if (new Date() > session.expiresAt) {
        await this.destroy(sid);
        return callback(null, null);
      }

      const sessionData = JSON.parse(session.data) as SessionData;
      callback(null, sessionData);
    } catch (err) {
      callback(err);
    }
  }

  async set(
    sid: string,
    session: SessionData,
    callback?: (err?: any) => void
  ): Promise<void> {
    try {
      const expiresAt = new Date(
        Date.now() + (session.cookie.maxAge || this.ttl)
      );

      await prisma.session.upsert({
        where: { sid },
        update: {
          data: JSON.stringify(session),
          expiresAt,
        },
        create: {
          sid,
          data: JSON.stringify(session),
          expiresAt,
        },
      });

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      const sessionExists = await prisma.session.findUnique({
        where: { sid },
      });

      if (sessionExists) {
        await prisma.session.delete({
          where: { sid },
        });
      }

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(
    sid: string,
    session: SessionData,
    callback?: (err?: any) => void
  ): Promise<void> {
    try {
      const expiresAt = new Date(
        Date.now() + (session.cookie.maxAge || this.ttl)
      );

      await prisma.session.update({
        where: { sid },
        data: { expiresAt },
      });

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (err) {
      console.error("Erreur lors du nettoyage des sessions:", err);
    }
  }

  async clear(callback?: (err?: any) => void): Promise<void> {
    try {
      await prisma.session.deleteMany({});
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async length(callback: (err: any, length?: number) => void): Promise<void> {
    try {
      const count = await prisma.session.count();
      callback(null, count);
    } catch (err) {
      callback(err);
    }
  }

  async all(
    callback: (err: any, sessions?: SessionData[] | null) => void
  ): Promise<void> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      const sessionData = sessions.map((session) => JSON.parse(session.data));
      callback(null, sessionData);
    } catch (err) {
      callback(err);
    }
  }
}
