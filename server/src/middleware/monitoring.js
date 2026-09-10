import { logger } from "../logger.js";

// Simple in-memory metrics
const metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byRoute: {},
    byStatus: {},
  },
  database: {
    queries: 0,
    errors: 0,
  },
  auth: {
    logins: 0,
    registrations: 0,
    failures: 0,
  },
  ussd: {
    sessions: 0,
    completions: 0,
    errors: 0,
  },
  startTime: Date.now(),
};

export function metricsCollector() {
  return (req, res, next) => {
    const start = Date.now();

    metrics.requests.total++;
    metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const statusGroup = `${Math.floor(status / 100)}xx`;

      metrics.requests.byStatus[statusGroup] = (metrics.requests.byStatus[statusGroup] || 0) + 1;

      // Track specific routes
      const route = req.route?.path || req.path;
      if (route) {
        if (!metrics.requests.byRoute[route]) {
          metrics.requests.byRoute[route] = { count: 0, totalDuration: 0, avgDuration: 0 };
        }
        metrics.requests.byRoute[route].count++;
        metrics.requests.byRoute[route].totalDuration += duration;
        metrics.requests.byRoute[route].avgDuration =
          metrics.requests.byRoute[route].totalDuration / metrics.requests.byRoute[route].count;
      }

      // Track auth events
      if (req.path === "/api/farmers/login" || req.path === "/api/staff/login") {
        if (status === 200) {
          metrics.auth.logins++;
        } else if (status >= 400) {
          metrics.auth.failures++;
        }
      } else if (req.path === "/api/farmers/register") {
        if (status === 201) {
          metrics.auth.registrations++;
        }
      } else if (req.path === "/ussd") {
        metrics.ussd.sessions++;
        if (status === 200) {
          metrics.ussd.completions++;
        } else if (status >= 400) {
          metrics.ussd.errors++;
        }
      }
    });

    next();
  };
}

export function trackDatabaseQuery() {
  metrics.database.queries++;
}

export function trackDatabaseError() {
  metrics.database.errors++;
}

export function getMetrics() {
  const uptime = Date.now() - metrics.startTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  return {
    uptime: {
      ms: uptime,
      seconds: uptimeSeconds,
      minutes: uptimeMinutes,
      hours: uptimeHours,
      formatted: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
    },
    requests: {
      ...metrics.requests,
      avgRequestsPerMinute: uptimeMinutes > 0 ? (metrics.requests.total / uptimeMinutes).toFixed(2) : 0,
    },
    database: metrics.database,
    auth: metrics.auth,
    ussd: metrics.ussd,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

export function healthCheckMiddleware(db) {
  return async (req, res, next) => {
    try {
      // Basic health check
      if (req.path === "/health") {
        return next();
      }

      // Detailed health check
      if (req.path === "/health/detailed") {
        const checks = {
          database: false,
          api: true,
          memory: false,
        };

        // Check database
        try {
          await db.query("SELECT 1");
          checks.database = true;
        } catch (error) {
          logger.error({ err: error }, "Database health check failed");
        }

        // Check memory usage
        const mem = process.memoryUsage();
        const maxHeap = 1024 * 1024 * 1024; // 1GB threshold
        checks.memory = mem.heapUsed < maxHeap;

        const allHealthy = Object.values(checks).every((v) => v === true);
        const status = allHealthy ? 200 : 503;

        return res.status(status).json({
          ok: allHealthy,
          checks,
          metrics: getMetrics(),
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
