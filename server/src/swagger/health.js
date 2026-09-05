/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 service:
 *                   type: string
 *                   example: nzeru-za-alimi
 *                 name:
 *                   type: string
 *                   example: Nzeru za Alimi
 *                 database:
 *                   type: string
 *                   example: postgresql
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Service unavailable
 *
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All checks passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: boolean
 *                     api:
 *                       type: boolean
 *                     memory:
 *                       type: boolean
 *                 metrics:
 *                   type: object
 *       503:
 *         description: One or more checks failed
 *
 * /metrics:
 *   get:
 *     summary: Application metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Current metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uptime:
 *                   type: object
 *                 requests:
 *                   type: object
 *                 database:
 *                   type: object
 *                 auth:
 *                   type: object
 *                 ussd:
 *                   type: object
 *                 memory:
 *                   type: object
 */

export default {};
