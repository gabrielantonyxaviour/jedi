export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  middleware() {
    return (req: any, res: any, next: any) => {
      const ip = req.ip || "default";
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 10;

      if (!this.requests.has(ip)) {
        this.requests.set(ip, []);
      }

      const requests = this.requests.get(ip)!;
      const validRequests = requests.filter((time) => now - time < windowMs);

      if (validRequests.length >= maxRequests) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      validRequests.push(now);
      this.requests.set(ip, validRequests);
      next();
    };
  }

  getStatus() {
    return { windowMs: 60000, maxRequests: 10 };
  }
}
