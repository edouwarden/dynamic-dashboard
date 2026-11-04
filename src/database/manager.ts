// Gestionnaire de base de données SQLite générique avec permissions

import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { CONFIG } from "../config";
import type { DbPermission, QueryRequest } from "../types";

export class DatabaseManager {
	private db: Database;

	constructor(dbPath: string = CONFIG.DB_PATH) {
		mkdirSync(dirname(dbPath), { recursive: true });
		this.db = new Database(dbPath, { create: true });
		this.init();
	}

	private init() {
		// Créer les tables par défaut
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS script_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        status TEXT CHECK(status IN ('success', 'error')),
        logs TEXT,
        error TEXT,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notification_center (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        icon TEXT,
        source TEXT DEFAULT 'system',
        source_id TEXT,
        source_name TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS opencode_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        session_id TEXT,
        message TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'haiku',
        thinking INTEGER NOT NULL DEFAULT 0,
        api_base_template TEXT NOT NULL,
        entity_label TEXT,
        panel_type TEXT NOT NULL DEFAULT 'widget',
        session_name TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_opencode_queue_position ON opencode_queue(position);
    `);

		console.log("[Database] Initialized with default tables");
	}

	/**
	 * Execute une requête SQL générique avec validation des permissions
	 *
	 * Note: Les permissions sont maintenant chargées depuis les widgets (manifest.json)
	 * au lieu des tabs (tab.json). Le tabId est conservé pour la compatibilité/logging.
	 */
	executeQuery(tabId: string, permissions: DbPermission[], query: QueryRequest): any {
		// 1. Vérifier que la table est autorisée
		const permission = permissions.find((p) => p.table === query.table);
		if (!permission) {
			throw new Error(`Table '${query.table}' not authorized`);
		}

		// 2. Vérifier que l'action est autorisée
		if (!permission.actions.includes(query.action)) {
			throw new Error(`Action '${query.action}' not authorized for table '${query.table}'`);
		}

		// 3. Construire et exécuter la requête
		switch (query.action) {
			case "select":
				return this.select(query, permission);

			case "insert":
				return this.insert(query, permission);

			case "update":
				return this.update(query, permission);

			case "delete":
				return this.delete(query, permission);

			default:
				throw new Error(`Unknown action: ${query.action}`);
		}
	}

	private select(query: QueryRequest, permission: DbPermission): any[] {
		const columns = this.getAuthorizedColumns(query.columns, permission.columns);
		const limit = Math.min(query.limit || 100, permission.maxRows || 1000);

		let sql = `SELECT ${columns.join(", ")} FROM ${query.table}`;
		const params: any[] = [];

		// WHERE clause
		if (query.where) {
			const conditions = Object.entries(query.where).map(([key, value]) => {
				params.push(value);
				return `${key} = ?`;
			});
			sql += ` WHERE ${conditions.join(" AND ")}`;
		}

		// ORDER BY
		if (query.orderBy) {
			sql += ` ORDER BY ${query.orderBy}`;
		}

		// LIMIT
		sql += ` LIMIT ${limit}`;

		const stmt = this.db.prepare(sql);
		return stmt.all(...params);
	}

	private insert(query: QueryRequest, permission: DbPermission): any {
		if (!query.data) {
			throw new Error("No data provided for insert");
		}

		const columns = Object.keys(query.data);
		const values = Object.values(query.data);

		// Vérifier les colonnes autorisées
		this.validateColumns(columns, permission.columns);

		const placeholders = columns.map(() => "?").join(", ");
		const sql = `INSERT INTO ${query.table} (${columns.join(", ")}) VALUES (${placeholders})`;

		const stmt = this.db.prepare(sql);
		stmt.run(...values);

		return {
			id: this.db.query("SELECT last_insert_rowid() as id").get() as any,
			changes: 1
		};
	}

	private update(query: QueryRequest, permission: DbPermission): any {
		if (!query.data) {
			throw new Error("No data provided for update");
		}

		const columns = Object.keys(query.data);
		this.validateColumns(columns, permission.columns);

		const setClause = columns.map((col) => `${col} = ?`).join(", ");
		const params = [...Object.values(query.data)];

		let sql = `UPDATE ${query.table} SET ${setClause}`;

		// WHERE clause (obligatoire pour update)
		if (query.where) {
			const conditions = Object.entries(query.where).map(([key, value]) => {
				params.push(value);
				return `${key} = ?`;
			});
			sql += ` WHERE ${conditions.join(" AND ")}`;
		} else {
			throw new Error("WHERE clause required for UPDATE");
		}

		const stmt = this.db.prepare(sql);
		stmt.run(...params);

		return { changes: this.db.query("SELECT changes() as changes").get() as any };
	}

	private delete(query: QueryRequest, permission: DbPermission): any {
		let sql = `DELETE FROM ${query.table}`;
		const params: any[] = [];

		// WHERE clause (obligatoire pour delete)
		if (query.where) {
			const conditions = Object.entries(query.where).map(([key, value]) => {
				params.push(value);
				return `${key} = ?`;
			});
			sql += ` WHERE ${conditions.join(" AND ")}`;
		} else {
			throw new Error("WHERE clause required for DELETE");
		}

		const stmt = this.db.prepare(sql);
		stmt.run(...params);

		return { changes: this.db.query("SELECT changes() as changes").get() as any };
	}

	private getAuthorizedColumns(requestedColumns: string[] | undefined, allowedColumns: string[] | undefined): string[] {
		// Si aucune restriction, autoriser toutes les colonnes
		if (!allowedColumns) {
			return requestedColumns || ["*"];
		}

		// Si des colonnes spécifiques sont demandées, vérifier qu'elles sont autorisées
		if (requestedColumns) {
			const unauthorized = requestedColumns.filter((c) => !allowedColumns.includes(c));
			if (unauthorized.length > 0) {
				throw new Error(`Columns not authorized: ${unauthorized.join(", ")}`);
			}
			return requestedColumns;
		}

		// Sinon, retourner toutes les colonnes autorisées
		return allowedColumns;
	}

	private validateColumns(columns: string[], allowedColumns: string[] | undefined) {
		if (!allowedColumns) return; // Pas de restriction

		const unauthorized = columns.filter((c) => !allowedColumns.includes(c));
		if (unauthorized.length > 0) {
			throw new Error(`Columns not authorized: ${unauthorized.join(", ")}`);
		}
	}

	/**
	 * Créer une nouvelle table
	 * schema can be a raw SQL string or an array of column definitions
	 */
	createTable(tableName: string, schema: string | Array<{ name: string; type: string; primaryKey?: boolean; autoIncrement?: boolean; notNull?: boolean; default?: string }>): void {
		// Valider le nom de la table (sécurité)
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		let schemaSql: string;
		if (typeof schema === "string") {
			schemaSql = schema;
		} else {
			// Convert array of column definitions to SQL
			schemaSql = schema
				.map((col) => {
					if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
						throw new Error(`Invalid column name: ${col.name}`);
					}
					let def = `${col.name} ${col.type || "TEXT"}`;
					if (col.primaryKey) {
						def += " PRIMARY KEY";
						if (col.autoIncrement) def += " AUTOINCREMENT";
					}
					if (col.notNull) def += " NOT NULL";
					if (col.default !== undefined) {
						const val = col.default;
						// Valeurs SQL spéciales à ne pas quoter
						if (typeof val === "number" || val === "NULL" || val === "CURRENT_TIMESTAMP" || val === "CURRENT_DATE" || val === "CURRENT_TIME" || val === "TRUE" || val === "FALSE") {
							def += ` DEFAULT ${val}`;
						} else {
							// Quoter les strings (échapper les quotes simples)
							def += ` DEFAULT '${String(val).replace(/'/g, "''")}'`;
						}
					}
					return def;
				})
				.join(", ");
		}

		const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${schemaSql})`;
		this.db.exec(sql);
		console.log(`[Database] Table '${tableName}' created`);
	}

	/**
	 * Obtenir le schéma d'une table
	 */
	getTableSchema(tableName: string): any[] {
		const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
		return stmt.all();
	}

	/**
	 * Lister toutes les tables (noms uniquement)
	 */
	getAllTableNames(): string[] {
		const stmt = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
		const result = stmt.all() as any[];
		return result.map((row: any) => row.name);
	}

	/**
	 * Lister toutes les tables avec stats et schéma
	 */
	getAllTables(): Array<{ name: string; rowCount: number; columns: Array<{ name: string; type: string; pk: boolean; notnull: boolean }> }> {
		const names = this.getAllTableNames();
		return names.map((name) => {
			try {
				const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${name}`);
				const count = (countStmt.get() as any).count;
				const schema = this.getTableSchema(name);
				return {
					name,
					rowCount: count,
					columns: schema.map((col: any) => ({
						name: col.name,
						type: col.type,
						pk: !!col.pk,
						notnull: !!col.notnull
					}))
				};
			} catch {
				return { name, rowCount: 0, columns: [] };
			}
		});
	}

	/**
	 * Supprimer une table
	 */
	dropTable(tableName: string): void {
		// Valider le nom de la table (sécurité)
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
		console.log(`[Database] Table '${tableName}' dropped`);
	}

	/**
	 * Obtenir des statistiques sur une table
	 */
	getTableStats(tableName: string): any {
		const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
		const count = countStmt.get() as any;

		return {
			name: tableName,
			rowCount: count.count,
			schema: this.getTableSchema(tableName)
		};
	}

	/**
	 * Explorer les données d'une table (SELECT * avec pagination)
	 * Utilisé pour le SQL Explorer - pas de permissions requises (admin only)
	 */
	exploreTable(tableName: string, limit: number = 100, offset: number = 0): any {
		// Valider le nom de la table (sécurité)
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		// Compter le total
		const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
		const countResult = countStmt.get() as any;
		const totalRows = countResult.count;

		// Récupérer les données
		const dataStmt = this.db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`);
		const rows = dataStmt.all(limit, offset);

		// Récupérer le schéma pour les noms de colonnes
		const schema = this.getTableSchema(tableName);
		const columns = schema.map((col: any) => col.name);

		return {
			table: tableName,
			columns,
			rows,
			totalRows,
			limit,
			offset,
			hasMore: offset + limit < totalRows
		};
	}

	/**
	 * Modifier une table existante (ALTER TABLE)
	 */
	alterTable(
		tableName: string,
		alterations: {
			addColumns?: Array<{ name: string; type: string; notNull?: boolean; defaultValue?: string }>;
			dropColumns?: string[];
		}
	): void {
		// Valider le nom de la table
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		// SQLite ne supporte pas DROP COLUMN directement avant la version 3.35.0
		// On va utiliser la méthode de recréation de table pour les suppressions
		if (alterations.dropColumns && alterations.dropColumns.length > 0) {
			this.dropColumnsFromTable(tableName, alterations.dropColumns);
		}

		// Ajouter les nouvelles colonnes
		if (alterations.addColumns && alterations.addColumns.length > 0) {
			for (const col of alterations.addColumns) {
				// Valider le nom de colonne
				if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
					throw new Error(`Invalid column name: ${col.name}`);
				}

				let sql = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`;
				if (col.notNull && col.defaultValue !== undefined) {
					sql += ` NOT NULL DEFAULT ${col.defaultValue}`;
				} else if (col.defaultValue !== undefined) {
					sql += ` DEFAULT ${col.defaultValue}`;
				}
				this.db.exec(sql);
			}
		}

		console.log(`[Database] Table '${tableName}' altered`);
	}

	/**
	 * Supprimer des colonnes d'une table (via recréation)
	 */
	private dropColumnsFromTable(tableName: string, columnsToDrop: string[]): void {
		// Récupérer le schéma actuel
		const currentSchema = this.getTableSchema(tableName);
		const columnsToKeep = currentSchema.filter((col: any) => !columnsToDrop.includes(col.name));

		if (columnsToKeep.length === 0) {
			throw new Error("Cannot drop all columns from a table");
		}

		// Construire le nouveau schéma
		const newSchemaColumns = columnsToKeep.map((col: any) => {
			let def = `${col.name} ${col.type}`;
			if (col.pk) def += " PRIMARY KEY";
			if (col.notnull) def += " NOT NULL";
			if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
			return def;
		});

		const columnNames = columnsToKeep.map((col: any) => col.name).join(", ");
		const tempTableName = `${tableName}_temp_${Date.now()}`;

		// Transaction pour la recréation
		this.db.exec("BEGIN TRANSACTION");
		try {
			// Créer une table temporaire avec le nouveau schéma
			this.db.exec(`CREATE TABLE ${tempTableName} (${newSchemaColumns.join(", ")})`);

			// Copier les données
			this.db.exec(`INSERT INTO ${tempTableName} (${columnNames}) SELECT ${columnNames} FROM ${tableName}`);

			// Supprimer l'ancienne table
			this.db.exec(`DROP TABLE ${tableName}`);

			// Renommer la table temporaire
			this.db.exec(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);

			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}

	/**
	 * Mettre à jour une ligne spécifique
	 */
	updateRow(tableName: string, rowId: any, data: Record<string, any>): any {
		// Valider le nom de la table
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		const columns = Object.keys(data);
		const values = Object.values(data);

		const setClause = columns.map((col) => `${col} = ?`).join(", ");
		const sql = `UPDATE ${tableName} SET ${setClause} WHERE rowid = ?`;

		const stmt = this.db.prepare(sql);
		stmt.run(...values, rowId);

		return { changes: (this.db.query("SELECT changes() as changes").get() as any).changes };
	}

	/**
	 * Supprimer une ligne spécifique
	 */
	deleteRow(tableName: string, rowId: any): any {
		// Valider le nom de la table
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		const sql = `DELETE FROM ${tableName} WHERE rowid = ?`;
		const stmt = this.db.prepare(sql);
		stmt.run(rowId);

		return { changes: (this.db.query("SELECT changes() as changes").get() as any).changes };
	}

	/**
	 * Exécuter une requête SQL brute (sans vérification de permissions)
	 * Réservé aux usages internes (logs, etc.)
	 */
	queryRaw(sql: string, params: any[] = []): any[] {
		const stmt = this.db.prepare(sql);
		// DELETE/INSERT/UPDATE retournent undefined avec .all(), utiliser .run() pour ces cas
		const upper = sql.trimStart().toUpperCase();
		if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA")) {
			return stmt.all(...params);
		}
		stmt.run(...params);
		return [];
	}

	/**
	 * Exécute une requête INSERT/UPDATE/DELETE retournant lastInsertRowid
	 */
	runRaw(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
		const stmt = this.db.prepare(sql);
		const result = stmt.run(...params);
		return { lastInsertRowid: result.lastInsertRowid as number, changes: result.changes };
	}

	/**
	 * Insérer une nouvelle ligne
	 */
	insertRow(tableName: string, data: Record<string, any>): any {
		// Valider le nom de la table
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
			throw new Error("Invalid table name");
		}

		const columns = Object.keys(data);
		const values = Object.values(data);
		const placeholders = columns.map(() => "?").join(", ");

		const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
		const stmt = this.db.prepare(sql);
		stmt.run(...values);

		const lastId = (this.db.query("SELECT last_insert_rowid() as id").get() as any).id;
		return { id: lastId, changes: 1 };
	}
}

export const databaseManager = new DatabaseManager();
export const demoDatabaseManager = new DatabaseManager(CONFIG.DEMO_DB_PATH);
