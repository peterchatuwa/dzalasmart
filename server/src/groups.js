import { randomBytes } from "node:crypto";
import { getFarmerById } from "./farmers.js";

function generateId(prefix = "grp") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export const GROUP_TYPES = {
  COOPERATIVE: "cooperative",
  CLUB: "club",
  ASSOCIATION: "association",
  VSLA: "VSLA",
  SACCO: "SACCO",
  OTHER: "other",
};

export const MEMBER_ROLES = {
  MEMBER: "member",
  LEADER: "leader",
  TREASURER: "treasurer",
  SECRETARY: "secretary",
  CHAIRPERSON: "chairperson",
};

/**
 * Create a new farmer group
 */
export async function createGroup(db, staff, data = {}) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Group name is required");

  const type = String(data.type || "").toLowerCase();
  if (!Object.values(GROUP_TYPES).includes(type)) {
    throw new Error(`Invalid group type. Must be one of: ${Object.values(GROUP_TYPES).join(", ")}`);
  }

  const district = String(data.district || staff.district || "").trim();
  if (!district) throw new Error("District is required");

  const id = generateId("grp");
  const epa = String(data.epa || staff.epa || "").trim() || null;
  const registrationNumber = String(data.registrationNumber || "").trim() || null;
  const registrationDate = data.registrationDate || null;
  const leaderFarmerId = data.leaderFarmerId || null;
  const createdAt = Date.now();

  if (leaderFarmerId) {
    const leader = await getFarmerById(db, leaderFarmerId);
    if (!leader) throw new Error("Leader farmer not found");
  }

  await db
    .prepare(
      `INSERT INTO farmer_groups (id, name, type, district, epa, registration_number, registration_date, leader_farmer_id, status, member_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`
    )
    .run(id, name, type, district, epa, registrationNumber, registrationDate, leaderFarmerId, createdAt);

  return getGroupById(db, id);
}

/**
 * Get group by ID
 */
export async function getGroupById(db, groupId) {
  const group = await db.prepare("SELECT * FROM farmer_groups WHERE id = ?").get(groupId);

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    type: group.type,
    district: group.district,
    epa: group.epa || null,
    registrationNumber: group.registration_number || null,
    registrationDate: group.registration_date || null,
    leaderFarmerId: group.leader_farmer_id || null,
    status: group.status,
    memberCount: group.member_count || 0,
    createdAt: group.created_at,
  };
}

/**
 * List groups (optionally filtered)
 */
export async function listGroups(db, options = {}) {
  const district = options.district || null;
  const epa = options.epa || null;
  const type = options.type || null;
  const status = options.status || "active";

  let query = "SELECT * FROM farmer_groups WHERE status = ?";
  const params = [status];

  if (district) {
    query += " AND district = ?";
    params.push(district);
  }

  if (epa) {
    query += " AND epa = ?";
    params.push(epa);
  }

  if (type) {
    query += " AND type = ?";
    params.push(type);
  }

  query += " ORDER BY name";

  const rows = await db.prepare(query).all(...params);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    district: row.district,
    epa: row.epa || null,
    registrationNumber: row.registration_number || null,
    memberCount: row.member_count || 0,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * Add farmer to group
 */
export async function addMemberToGroup(db, groupId, farmerId, role = "member") {
  const group = await getGroupById(db, groupId);
  if (!group) throw new Error("Group not found");

  const farmer = await getFarmerById(db, farmerId);
  if (!farmer) throw new Error("Farmer not found");

  if (!Object.values(MEMBER_ROLES).includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${Object.values(MEMBER_ROLES).join(", ")}`);
  }

  // Check if already a member
  const existing = await db
    .prepare(
      "SELECT * FROM farmer_group_members WHERE farmer_id = ? AND group_id = ? AND status = 'active'"
    )
    .get(farmerId, groupId);

  if (existing) {
    throw new Error("Farmer is already a member of this group");
  }

  const id = generateId("mem");
  const joinedAt = Date.now();

  await db
    .prepare(
      `INSERT INTO farmer_group_members (id, farmer_id, group_id, role, joined_at, left_at, status)
       VALUES (?, ?, ?, ?, ?, NULL, 'active')`
    )
    .run(id, farmerId, groupId, role, joinedAt);

  // Update member count
  await db
    .prepare("UPDATE farmer_groups SET member_count = member_count + 1 WHERE id = ?")
    .run(groupId);

  return getMembershipById(db, id);
}

/**
 * Remove farmer from group
 */
export async function removeMemberFromGroup(db, groupId, farmerId) {
  const membership = await db
    .prepare(
      "SELECT * FROM farmer_group_members WHERE farmer_id = ? AND group_id = ? AND status = 'active'"
    )
    .get(farmerId, groupId);

  if (!membership) {
    throw new Error("Farmer is not a member of this group");
  }

  const now = Date.now();

  await db
    .prepare(
      "UPDATE farmer_group_members SET status = 'inactive', left_at = ? WHERE id = ?"
    )
    .run(now, membership.id);

  // Update member count
  await db
    .prepare("UPDATE farmer_groups SET member_count = member_count - 1 WHERE id = ?")
    .run(groupId);

  return { ...membership, status: "inactive", leftAt: now };
}

/**
 * Get membership by ID
 */
export async function getMembershipById(db, membershipId) {
  const row = await db
    .prepare(
      `SELECT m.*, f.name as farmer_name, f.phone as farmer_phone, g.name as group_name
       FROM farmer_group_members m
       JOIN farmers f ON m.farmer_id = f.id
       JOIN farmer_groups g ON m.group_id = g.id
       WHERE m.id = ?`
    )
    .get(membershipId);

  if (!row) return null;

  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    farmerPhone: row.farmer_phone,
    groupId: row.group_id,
    groupName: row.group_name,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at || null,
    status: row.status,
  };
}

/**
 * List group members
 */
export async function listGroupMembers(db, groupId, options = {}) {
  const status = options.status || "active";

  const rows = await db
    .prepare(
      `SELECT m.*, f.name as farmer_name, f.phone as farmer_phone, f.district, f.epa
       FROM farmer_group_members m
       JOIN farmers f ON m.farmer_id = f.id
       WHERE m.group_id = ? AND m.status = ?
       ORDER BY m.joined_at DESC`
    )
    .all(groupId, status);

  return rows.map((row) => ({
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    farmerPhone: row.farmer_phone,
    district: row.district,
    epa: row.epa || null,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at || null,
    status: row.status,
  }));
}

/**
 * List farmer's groups
 */
export async function listFarmerGroups(db, farmerId) {
  const rows = await db
    .prepare(
      `SELECT m.*, g.name as group_name, g.type, g.district, g.epa, g.member_count
       FROM farmer_group_members m
       JOIN farmer_groups g ON m.group_id = g.id
       WHERE m.farmer_id = ? AND m.status = 'active' AND g.status = 'active'
       ORDER BY m.joined_at DESC`
    )
    .all(farmerId);

  return rows.map((row) => ({
    membershipId: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    type: row.type,
    district: row.district,
    epa: row.epa || null,
    memberCount: row.member_count,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

/**
 * Update member role
 */
export async function updateMemberRole(db, membershipId, newRole) {
  if (!Object.values(MEMBER_ROLES).includes(newRole)) {
    throw new Error(`Invalid role. Must be one of: ${Object.values(MEMBER_ROLES).join(", ")}`);
  }

  const membership = await getMembershipById(db, membershipId);
  if (!membership) throw new Error("Membership not found");

  await db
    .prepare("UPDATE farmer_group_members SET role = ? WHERE id = ?")
    .run(newRole, membershipId);

  return { ...membership, role: newRole };
}

/**
 * Get group statistics
 */
export async function getGroupStats(db, options = {}) {
  const district = options.district || null;

  let whereClause = "WHERE g.status = 'active'";
  const params = [];

  if (district) {
    whereClause += " AND g.district = ?";
    params.push(district);
  }

  const stats = await db
    .prepare(
      `SELECT 
         COUNT(DISTINCT g.id) as total_groups,
         SUM(g.member_count) as total_members,
         COUNT(DISTINCT CASE WHEN g.type = 'cooperative' THEN g.id END) as cooperatives,
         COUNT(DISTINCT CASE WHEN g.type = 'club' THEN g.id END) as clubs,
         COUNT(DISTINCT CASE WHEN g.type = 'VSLA' THEN g.id END) as vslas,
         COUNT(DISTINCT CASE WHEN g.type = 'SACCO' THEN g.id END) as saccos
       FROM farmer_groups g
       ${whereClause}`
    )
    .get(...params);

  return {
    totalGroups: stats.total_groups || 0,
    totalMembers: stats.total_members || 0,
    cooperatives: stats.cooperatives || 0,
    clubs: stats.clubs || 0,
    vslas: stats.vslas || 0,
    saccos: stats.saccos || 0,
  };
}

/**
 * Seed demo groups
 */
export async function seedGroupsIfEmpty(db) {
  const count = await db.prepare("SELECT COUNT(*) as count FROM farmer_groups").get();

  if (count.count > 0) return false;

  const now = Date.now();

  // Get first staff member (extension officer)
  const staff = await db.prepare("SELECT * FROM staff WHERE role = 'extension' LIMIT 1").get();
  if (!staff) return false;

  // Get demo farmers
  const farmers = await db.prepare("SELECT * FROM farmers LIMIT 3").all();
  if (farmers.length === 0) return false;

  // Create 2 demo groups
  const groups = [
    {
      id: "grp_kasungu_coop",
      name: "Kasungu Grain Growers Cooperative",
      type: "cooperative",
      district: "Kasungu",
      epa: "Kasungu EPA",
      registrationNumber: "COOP/2020/KSG/001",
      registrationDate: now - 365 * 24 * 60 * 60 * 1000, // 1 year ago
      leaderFarmerId: farmers[0].id,
    },
    {
      id: "grp_lilongwe_club",
      name: "Zidyana Farmers Club",
      type: "club",
      district: "Lilongwe",
      epa: "Zidyana EPA",
      registrationNumber: null,
      registrationDate: null,
      leaderFarmerId: farmers[1].id,
    },
  ];

  for (const group of groups) {
    await db
      .prepare(
        `INSERT INTO farmer_groups (id, name, type, district, epa, registration_number, registration_date, leader_farmer_id, status, member_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`
      )
      .run(
        group.id,
        group.name,
        group.type,
        group.district,
        group.epa,
        group.registrationNumber,
        group.registrationDate,
        group.leaderFarmerId,
        now
      );
  }

  // Add farmers to groups
  for (let i = 0; i < farmers.length; i++) {
    const farmer = farmers[i];
    const groupId = i < 2 ? groups[0].id : groups[1].id;
    const role = i === 0 ? "leader" : i === 1 ? "treasurer" : "member";

    await db
      .prepare(
        `INSERT INTO farmer_group_members (id, farmer_id, group_id, role, joined_at, left_at, status)
         VALUES (?, ?, ?, ?, ?, NULL, 'active')`
      )
      .run(generateId("mem"), farmer.id, groupId, role, now);

    await db
      .prepare("UPDATE farmer_groups SET member_count = member_count + 1 WHERE id = ?")
      .run(groupId);
  }

  return true;
}
