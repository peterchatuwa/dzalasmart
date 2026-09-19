/**
 * @swagger
 * /api/farmers/register:
 *   post:
 *     summary: Register a new farmer
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - pin
 *               - district
 *             properties:
 *               name:
 *                 type: string
 *                 example: Grace Banda
 *               phone:
 *                 type: string
 *                 example: "0888000001"
 *               pin:
 *                 type: string
 *                 example: "1234"
 *               district:
 *                 type: string
 *                 example: Lilongwe
 *               epa:
 *                 type: string
 *                 example: Mitundu
 *     responses:
 *       201:
 *         description: Farmer registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 farmer:
 *                   $ref: '#/components/schemas/Farmer'
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Phone number already registered
 *       429:
 *         description: Too many registration attempts
 *
 * /api/farmers/login:
 *   post:
 *     summary: Login as a farmer
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - pin
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "0888000001"
 *               pin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 farmer:
 *                   $ref: '#/components/schemas/Farmer'
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 *
 * /api/farmers/me:
 *   get:
 *     summary: Get current farmer profile
 *     tags: [Farmers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Farmer profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 farmer:
 *                   $ref: '#/components/schemas/Farmer'
 *       401:
 *         description: Not authenticated
 *
 * /api/farmers/me/status:
 *   get:
 *     summary: Get farmer season status
 *     tags: [Season]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Season status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 farmer:
 *                   $ref: '#/components/schemas/Farmer'
 *                 currentStage:
 *                   $ref: '#/components/schemas/Stage'
 *                 nextStage:
 *                   $ref: '#/components/schemas/Stage'
 *                 seasonComplete:
 *                   type: boolean
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SeasonEvent'
 *       401:
 *         description: Not authenticated
 *
 * /api/farmers/me/events:
 *   post:
 *     summary: Log a season event
 *     tags: [Season]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stageKey:
 *                 type: string
 *                 description: Optional specific stage to log
 *     responses:
 *       201:
 *         description: Event logged
 *       400:
 *         description: Invalid stage or season already complete
 *       401:
 *         description: Not authenticated
 */

export default {};
