import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TransportMealsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  // ── Buses ──────────────────────────────────────────────────────────────────

  async createBus(dto: { registrationNo: string; makeModel?: string; capacity: number }) {
    const { rows } = await this.pool.query(
      `INSERT INTO bus (id, tenant_id, registration_no, make_model, capacity)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4)
       RETURNING *`,
      [uuidv4(), dto.registrationNo, dto.makeModel ?? null, dto.capacity],
    );
    return rows[0];
  }

  async listBuses() {
    const { rows } = await this.pool.query(`SELECT * FROM bus WHERE active = true ORDER BY registration_no`);
    return rows;
  }

  // ── Routes ─────────────────────────────────────────────────────────────────

  async createRoute(dto: {
    busId?: string;
    driverStaffId?: string;
    name: string;
    direction: 'inbound' | 'outbound' | 'both';
    departureTime?: string;
    monthlyFee: string;
    termFee: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO route (id, tenant_id, bus_id, driver_staff_id, name, direction, departure_time, monthly_fee, term_fee)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        uuidv4(), dto.busId ?? null, dto.driverStaffId ?? null,
        dto.name, dto.direction, dto.departureTime ?? null,
        dto.monthlyFee, dto.termFee,
      ],
    );
    await this.audit.log({ action: 'route.create', resource: 'route', resourceId: rows[0].id });
    return rows[0];
  }

  async listRoutes() {
    const { rows } = await this.pool.query(
      `SELECT r.*,
         b.registration_no AS bus_reg, b.capacity AS bus_capacity,
         s.legal_name AS driver_name,
         COUNT(pp.id) AS stop_count,
         COUNT(ra.id) FILTER (WHERE ra.status = 'active') AS student_count
       FROM route r
       LEFT JOIN bus b ON b.id = r.bus_id
       LEFT JOIN staff s ON s.id = r.driver_staff_id
       LEFT JOIN pickup_point pp ON pp.route_id = r.id
       LEFT JOIN route_assignment ra ON ra.route_id = r.id
       WHERE r.active = true
       GROUP BY r.id, b.registration_no, b.capacity, s.legal_name
       ORDER BY r.name`,
    );
    return rows;
  }

  async addPickupPoint(routeId: string, dto: {
    name: string;
    stopOrder: number;
    estimatedTime?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO pickup_point (id, tenant_id, route_id, name, stop_order, estimated_time, latitude, longitude)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        uuidv4(), routeId, dto.name, dto.stopOrder,
        dto.estimatedTime ?? null, dto.latitude ?? null, dto.longitude ?? null,
      ],
    );
    return rows[0];
  }

  async listPickupPoints(routeId: string) {
    const { rows } = await this.pool.query(
      `SELECT pp.*,
         COUNT(ra.id) FILTER (WHERE ra.status = 'active') AS student_count
       FROM pickup_point pp
       LEFT JOIN route_assignment ra ON ra.pickup_point_id = pp.id
       WHERE pp.route_id = $1
       GROUP BY pp.id
       ORDER BY pp.stop_order`,
      [routeId],
    );
    return rows;
  }

  async assignStudentToRoute(dto: {
    studentId: string;
    routeId: string;
    pickupPointId?: string;
    termId: string;
  }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO route_assignment (id, tenant_id, student_id, route_id, pickup_point_id, term_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_id, term_id, route_id) DO UPDATE SET status = 'active', updated_at = NOW()
       RETURNING *`,
      [uuidv4(), tenantId, dto.studentId, dto.routeId, dto.pickupPointId ?? null, dto.termId],
    );
    return rows[0];
  }

  async removeStudentFromRoute(assignmentId: string) {
    const { rows } = await this.pool.query(
      `UPDATE route_assignment SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [assignmentId],
    );
    if (!rows[0]) throw new NotFoundException('Route assignment not found');
    return rows[0];
  }

  async getRouteManifest(routeId: string, termId: string) {
    const { rows } = await this.pool.query(
      `SELECT ra.*, s.legal_name AS student_name, s.admission_no,
         pp.name AS pickup_point_name, pp.stop_order, pp.estimated_time,
         g.legal_name AS guardian_name, g.phone AS guardian_phone
       FROM route_assignment ra
       JOIN student s ON s.id = ra.student_id
       LEFT JOIN pickup_point pp ON pp.id = ra.pickup_point_id
       LEFT JOIN student_guardian sg ON sg.student_id = s.id AND sg.is_primary = true
       LEFT JOIN guardian g ON g.id = sg.guardian_id
       WHERE ra.route_id = $1 AND ra.term_id = $2 AND ra.status = 'active'
       ORDER BY pp.stop_order NULLS LAST, s.legal_name`,
      [routeId, termId],
    );
    return rows;
  }

  // ── Meal Plans ─────────────────────────────────────────────────────────────

  async createMealPlan(dto: {
    name: string;
    mealTypes: string[];
    dailyRate: string;
    termRate: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO meal_plan (id, tenant_id, name, meal_types, daily_rate, term_rate)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5)
       RETURNING *`,
      [uuidv4(), dto.name, JSON.stringify(dto.mealTypes), dto.dailyRate, dto.termRate],
    );
    return rows[0];
  }

  async listMealPlans() {
    const { rows } = await this.pool.query(
      `SELECT mp.*, COUNT(cw.id) AS wallet_count
       FROM meal_plan mp
       LEFT JOIN canteen_wallet cw ON cw.meal_plan_id = mp.id AND cw.active = true
       WHERE mp.active = true
       GROUP BY mp.id
       ORDER BY mp.name`,
    );
    return rows;
  }

  // ── Canteen Wallets ────────────────────────────────────────────────────────

  async getOrCreateWallet(studentId: string, mealPlanId?: string) {
    const { tenantId } = TenantStorage.get();
    const existing = await this.pool.query(
      `SELECT * FROM canteen_wallet WHERE student_id = $1`, [studentId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const { rows } = await this.pool.query(
      `INSERT INTO canteen_wallet (id, tenant_id, student_id, meal_plan_id, balance)
       VALUES ($1,$2,$3,$4, 0) RETURNING *`,
      [uuidv4(), tenantId, studentId, mealPlanId ?? null],
    );
    return rows[0];
  }

  async getWallet(studentId: string) {
    const { rows } = await this.pool.query(
      `SELECT cw.*, mp.name AS meal_plan_name, mp.meal_types,
         s.legal_name AS student_name, s.admission_no
       FROM canteen_wallet cw
       JOIN student s ON s.id = cw.student_id
       LEFT JOIN meal_plan mp ON mp.id = cw.meal_plan_id
       WHERE cw.student_id = $1`,
      [studentId],
    );
    if (!rows[0]) throw new NotFoundException('Wallet not found — call create first');
    return rows[0];
  }

  async topUpWallet(studentId: string, amount: string, recordedByUserId: string) {
    if (new Decimal(amount).lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be positive');

    const wallet = await this.getOrCreateWallet(studentId);
    const newBalance = new Decimal(wallet.balance as string).plus(new Decimal(amount));

    await this.pool.query(
      `UPDATE canteen_wallet SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance.toFixed(4), wallet.id],
    );

    const { rows } = await this.pool.query(
      `INSERT INTO canteen_transaction
        (id, tenant_id, wallet_id, type, amount, balance_after, description, meal_type, recorded_by)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,'credit',$3,$4,'Top-up','topup',$5)
       RETURNING *`,
      [uuidv4(), wallet.id, amount, newBalance.toFixed(4), recordedByUserId],
    );

    await this.audit.log({ action: 'canteen_wallet.topup', resource: 'canteen_wallet', resourceId: wallet.id as string, after: { amount, newBalance: newBalance.toFixed(2) } });
    return rows[0];
  }

  async recordMeal(studentId: string, mealType: string, recordedByUserId: string) {
    const wallet = await this.getWallet(studentId);
    const plan = wallet.meal_plan_id
      ? await this.pool.query(`SELECT * FROM meal_plan WHERE id = $1`, [wallet.meal_plan_id])
      : null;

    const dailyRate = plan?.rows[0]?.daily_rate
      ? new Decimal(plan.rows[0].daily_rate as string).dividedBy(
          (plan.rows[0].meal_types as string[]).length || 1,
        )
      : new Decimal(0);

    const currentBalance = new Decimal(wallet.balance as string);
    if (dailyRate.greaterThan(0) && currentBalance.lessThan(dailyRate)) {
      throw new ConflictException(`Insufficient canteen balance: TZS ${currentBalance.toFixed(2)}`);
    }

    const newBalance = currentBalance.minus(dailyRate);

    if (dailyRate.greaterThan(0)) {
      await this.pool.query(
        `UPDATE canteen_wallet SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance.toFixed(4), wallet.id],
      );
    }

    const { rows } = await this.pool.query(
      `INSERT INTO canteen_transaction
        (id, tenant_id, wallet_id, type, amount, balance_after, description, meal_type, txn_date, recorded_by)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,'debit',$3,$4,$5,$6,CURRENT_DATE,$7)
       RETURNING *`,
      [
        uuidv4(), wallet.id,
        dailyRate.toFixed(4), newBalance.toFixed(4),
        `${mealType} served`, mealType, recordedByUserId,
      ],
    );
    return rows[0];
  }

  async getWalletTransactions(studentId: string, limit = 50) {
    const wallet = await this.getWallet(studentId);
    const { rows } = await this.pool.query(
      `SELECT * FROM canteen_transaction WHERE wallet_id = $1 ORDER BY txn_date DESC, created_at DESC LIMIT $2`,
      [wallet.id, limit],
    );
    return { wallet, transactions: rows };
  }

  async getDailyMealReport(date: string) {
    const { rows } = await this.pool.query(
      `SELECT ct.meal_type,
         COUNT(*) AS serving_count,
         COALESCE(SUM(ct.amount), 0) AS total_amount
       FROM canteen_transaction ct
       WHERE ct.txn_date = $1 AND ct.type = 'debit'
       GROUP BY ct.meal_type
       ORDER BY ct.meal_type`,
      [date],
    );
    return { date, meals: rows };
  }

  async getTransportDashboard() {
    const [routeStats, busStats] = await Promise.all([
      this.pool.query(`
        SELECT COUNT(*) AS active_routes,
          SUM(student_count) AS total_students_on_transport
        FROM (
          SELECT r.id, COUNT(ra.id) FILTER (WHERE ra.status = 'active') AS student_count
          FROM route r
          LEFT JOIN route_assignment ra ON ra.route_id = r.id
          WHERE r.active = true
          GROUP BY r.id
        ) sub
      `),
      this.pool.query(`SELECT COUNT(*) AS active_buses FROM bus WHERE active = true`),
    ]);

    return {
      routes: routeStats.rows[0],
      buses: busStats.rows[0],
    };
  }
}
