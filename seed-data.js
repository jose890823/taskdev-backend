/**
 * Seed script for BOHOPHY business data
 * Run: node seed-data.js
 *
 * Connects directly to PostgreSQL and inserts all business data
 * in a single transaction with parameterized queries.
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ============================================
// CONFIG
// ============================================
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'michambita',
  user: 'postgres',
  password: 'postgres',
};

const SALT_ROUNDS = 10;

// ============================================
// SYSTEM CODE GENERATOR (mirrors system-code-generator.util.ts)
// ============================================
const ENTITY_PREFIX_MAP = {
  User: 'USR',
  Business: 'BIZ',
  Category: 'CAT',
  Supplier: 'SUP',
  Product: 'PRD',
  StockMovement: 'STK',
  Customer: 'CUS',
  OrderStatus: 'OST',
  Order: 'ORD',
  OrderPayment: 'PAY',
  Task: 'TSK',
};

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRandomChars(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC_CHARS.charAt(
      Math.floor(Math.random() * ALPHANUMERIC_CHARS.length)
    );
  }
  return result;
}

function generateSystemCode(entityName) {
  const prefix = ENTITY_PREFIX_MAP[entityName];
  if (!prefix) {
    throw new Error(`No prefix found for entity "${entityName}"`);
  }
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;
  const randomPart = generateRandomChars(4);
  return `${prefix}-${dateStr}-${randomPart}`;
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function seed() {
  const client = new Client(DB_CONFIG);

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected successfully.');

    // Check if BOHOPHY business already exists
    const existing = await client.query(
      `SELECT id FROM businesses WHERE name = $1 AND "deletedAt" IS NULL`,
      ['BOHOPHY']
    );
    if (existing.rows.length > 0) {
      console.log('BOHOPHY business already exists. Skipping seed.');
      await client.end();
      return;
    }

    // Hash passwords
    console.log('Hashing passwords...');
    const hashedPassword = await bcrypt.hash('Bohophy123!', SALT_ROUNDS);

    // ============================================
    // GENERATE ALL IDs UPFRONT
    // ============================================
    const ids = {
      business: uuid(),
      ownerUser: uuid(),
      employeeUser: uuid(),
      // Categories
      catVelas: uuid(),
      catEmpaque: uuid(),
      catDecoraciones: uuid(),
      catArtesanias: uuid(),
      catBolsas: uuid(),
      catAbanicos: uuid(),
      catMesa: uuid(),
      // Suppliers
      supFernanda: uuid(),
      supEmpack: uuid(),
      supMotitas: uuid(),
      // Customers
      cusTizoc: uuid(),
      cusSilvia: uuid(),
      cusMaria: uuid(),
      cusRoberto: uuid(),
      cusAna: uuid(),
      // Order Statuses
      osPendiente: uuid(),
      osConAnticipo: uuid(),
      osPagado: uuid(),
      osEntregado: uuid(),
      osCancelado: uuid(),
      // Orders
      order1: uuid(),
      order2: uuid(),
    };

    // Product IDs (we need them for order items and stock movements)
    const productIds = {};
    const productNames = [
      // Fernanda Velas
      'velaConchLima', 'velaConchPatch', 'velaCuadLima', 'velaEstrella', 'velaTapa',
      'jabones', 'velaConchita', 'velaCuadPeq',
      // Empack
      'cajaZica', 'cajaRosa', 'rolloEmplayado', 'cajaPanoque', 'cajaPastel',
      'cajaEnvioAbanicos', 'pliegoCarton', 'cintaScotch', 'pliegoMarquilla',
      'rolloHenequen', 'telaMantequilla', 'etiquetaQR', 'sobresVIP',
      'sobresArtesana', 'tarjetasGenericas', 'tarjetasVIP', 'catalogos',
      'rolloHenequenFino', 'rolloGrueso',
      // Motitas
      'motitasNaranjas', 'motitasRosas', 'motitasAzules',
      // Artesanias de Piel
      'keyChain1', 'pielCuadrado', 'pielCuadroGrande', 'pielRecuadro',
      'pielTiraGruesa', 'walletCard',
      // Bolsas y Accesorios
      'rosaritoPremium', 'rosaritoWholesale', 'santoriniAro', 'santoriniPaleta',
      'sisalBag', 'sobreMarketing', 'tequilero', 'trancoso',
      'treasureBucket', 'tulumBag', 'boraBora', 'zicatelaPremium',
      'zicatelaWholesale', 'tableroBg', 'yucaCoasters',
      // Abanicos
      'seychellePetit', 'shelaFan',
    ];
    for (const name of productNames) {
      productIds[name] = uuid();
    }

    console.log('Starting transaction...');
    await client.query('BEGIN');

    // ============================================
    // 1. BUSINESS
    // ============================================
    console.log('  [1/11] Inserting business...');
    // First, we need an owner user. But business needs ownerId, and user needs businessId.
    // We'll insert the owner user first WITHOUT businessId, then the business, then update the user.
    await client.query(
      `INSERT INTO users (
        id, "systemCode", email, password, "firstName", "lastName", phone,
        roles, "emailVerified", "isActive", "isSystemUser", "businessId",
        "preferredLanguage", "preferredCurrency", "preferredTimezone"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        ids.ownerUser, generateSystemCode('User'),
        'fernanda@bohophy.com', hashedPassword,
        'Fernanda', 'Bohophy', '+523311234567',
        'owner', true, true, false, null,
        'es', 'MXN', 'America/Mexico_City',
      ]
    );

    await client.query(
      `INSERT INTO businesses (
        id, "systemCode", name, slug, description, phone, email,
        city, state, country, currency, timezone, "isActive", "ownerId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        ids.business, generateSystemCode('Business'),
        'BOHOPHY', 'bohophy',
        'Tienda de artesanias, velas y productos hechos a mano',
        '+523311234567', 'ventas@bohophy.com',
        'Guadalajara', 'Jalisco', 'Mexico',
        'MXN', 'America/Mexico_City', true, ids.ownerUser,
      ]
    );

    // Update owner user with businessId
    await client.query(
      `UPDATE users SET "businessId" = $1 WHERE id = $2`,
      [ids.business, ids.ownerUser]
    );

    // ============================================
    // 2. EMPLOYEE USER
    // ============================================
    console.log('  [2/11] Inserting employee user...');
    await client.query(
      `INSERT INTO users (
        id, "systemCode", email, password, "firstName", "lastName", phone,
        roles, "emailVerified", "isActive", "isSystemUser", "businessId",
        "preferredLanguage", "preferredCurrency", "preferredTimezone"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        ids.employeeUser, generateSystemCode('User'),
        'carlos@bohophy.com', hashedPassword,
        'Carlos', 'Lopez', '+523319876543',
        'employee', true, true, false, ids.business,
        'es', 'MXN', 'America/Mexico_City',
      ]
    );

    // ============================================
    // 3. CATEGORIES
    // ============================================
    console.log('  [3/11] Inserting categories...');
    const categories = [
      [ids.catVelas, 'Velas', '#f59e0b', 0],
      [ids.catEmpaque, 'Empaque', '#6366f1', 1],
      [ids.catDecoraciones, 'Decoraciones', '#ec4899', 2],
      [ids.catArtesanias, 'Artesanias de Piel', '#8b5cf6', 3],
      [ids.catBolsas, 'Bolsas y Accesorios', '#22c55e', 4],
      [ids.catAbanicos, 'Abanicos', '#06b6d4', 5],
      [ids.catMesa, 'Productos de Mesa', '#f97316', 6],
    ];

    for (const [catId, name, color, sortOrder] of categories) {
      await client.query(
        `INSERT INTO categories (
          id, "systemCode", name, color, "businessId", "sortOrder", "isActive"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [catId, generateSystemCode('Category'), name, color, ids.business, sortOrder, true]
      );
    }

    // ============================================
    // 4. SUPPLIERS
    // ============================================
    console.log('  [4/11] Inserting suppliers...');
    const suppliers = [
      [ids.supFernanda, 'Fernanda Velas', 'Fernanda', 'fernanda.velas@gmail.com', '+523312345678', 'Proveedor de velas artesanales'],
      [ids.supEmpack, 'Empack', 'Empack Ventas', 'ventas@empack.mx', '+523398765432', 'Proveedor de empaque y material de envio'],
      [ids.supMotitas, 'Motitas Chayito', 'Chayito', 'motitas.chayito@gmail.com', '+523387654321', 'Proveedor de motitas decorativas'],
    ];

    for (const [supId, name, contactName, email, phone, notes] of suppliers) {
      await client.query(
        `INSERT INTO suppliers (
          id, "systemCode", name, "contactName", email, phone, notes, "businessId", "isActive"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [supId, generateSystemCode('Supplier'), name, contactName, email, phone, notes, ids.business, true]
      );
    }

    // ============================================
    // 5. PRODUCTS
    // ============================================
    console.log('  [5/11] Inserting products...');

    // Helper to insert product
    async function insertProduct(id, name, unit, currentStock, desiredStock, minStock, costPrice, salePrice, categoryId, supplierId) {
      await client.query(
        `INSERT INTO products (
          id, "systemCode", name, unit, "currentStock", "desiredStock", "minStock",
          "costPrice", "salePrice", "categoryId", "supplierId", "businessId", "isActive"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id, generateSystemCode('Product'), name, unit,
          currentStock, desiredStock, minStock, costPrice, salePrice,
          categoryId, supplierId, ids.business, true,
        ]
      );
    }

    // FERNANDA VELAS products (category: Velas, supplier: Fernanda Velas)
    await insertProduct(productIds.velaConchLima, 'Vela Concha (Lima-nardo-musgo)', 'unidad', 14, 20, 5, 45, 90, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaConchPatch, 'Vela Concha (Patchuly-cedro)', 'unidad', 14, 20, 5, 45, 90, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaCuadLima, 'Vela Cuadrada (Lima-nardo)', 'unidad', 1, 20, 5, 50, 100, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaEstrella, 'Vela Estrella', 'unidad', 1, 0, 0, 55, 110, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaTapa, 'Vela Tapa', 'unidad', 1, 0, 0, 40, 80, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.jabones, 'Jabones artesanales', 'unidad', 0, 20, 5, 25, 50, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaConchita, 'Vela Conchita', 'unidad', 8, 20, 5, 35, 50, ids.catVelas, ids.supFernanda);
    await insertProduct(productIds.velaCuadPeq, 'Vela Cuadrada pequena', 'unidad', 5, 20, 5, 35, 35, ids.catVelas, ids.supFernanda);

    // EMPACK products (category: Empaque, supplier: Empack)
    await insertProduct(productIds.cajaZica, 'Caja Marketing ZICA', 'unidad', 198, 100, 20, 5, 10, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.cajaRosa, 'Caja Marketing ROSA', 'unidad', 200, 100, 20, 5, 10, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.rolloEmplayado, 'Rollo Emplayado', 'unidad', 1, 2, 1, 80, 120, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.cajaPanoque, 'Caja Panoque', 'unidad', 21, 50, 10, 8, 15, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.cajaPastel, 'Caja Pastel', 'unidad', 8, 50, 10, 10, 18, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.cajaEnvioAbanicos, 'Caja envio 100 abanicos', 'unidad', 14, 20, 5, 25, 40, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.pliegoCarton, 'Pliego carton', 'unidad', 4, 6, 2, 15, 25, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.cintaScotch, 'Cinta scotch transparente', 'unidad', 4, 10, 3, 12, 20, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.pliegoMarquilla, 'Pliego marquilla', 'unidad', 2, 10, 3, 18, 30, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.rolloHenequen, 'Rollo henequen', 'unidad', 1, 3, 1, 120, 180, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.telaMantequilla, 'Tela mantequilla', 'metro', 70, 150, 30, 15, 25, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.etiquetaQR, 'Etiqueta QR', 'unidad', 35, 50, 10, 2, 5, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.sobresVIP, 'Sobres VIP', 'unidad', 45, 50, 10, 8, 15, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.sobresArtesana, 'Sobres artesana', 'unidad', 68, 50, 10, 6, 12, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.tarjetasGenericas, 'Tarjetas genericas', 'unidad', 0, 50, 10, 3, 6, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.tarjetasVIP, 'Tarjetas VIP', 'unidad', 191, 50, 10, 5, 10, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.catalogos, 'Catalogos', 'unidad', 4, 150, 30, 15, 25, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.rolloHenequenFino, 'Rollo Henequen Fino', 'unidad', 4, 5, 1, 150, 220, ids.catEmpaque, ids.supEmpack);
    await insertProduct(productIds.rolloGrueso, 'Rollo Grueso', 'unidad', 1, 3, 1, 100, 160, ids.catEmpaque, ids.supEmpack);

    // MOTITAS CHAYITO products (category: Decoraciones, supplier: Motitas Chayito)
    await insertProduct(productIds.motitasNaranjas, 'Motitas Naranjas', 'unidad', 6, 20, 5, 8, 15, ids.catDecoraciones, ids.supMotitas);
    await insertProduct(productIds.motitasRosas, 'Motitas Rosas', 'unidad', 11, 20, 5, 8, 15, ids.catDecoraciones, ids.supMotitas);
    await insertProduct(productIds.motitasAzules, 'Motitas Azules', 'unidad', 21, 20, 5, 8, 15, ids.catDecoraciones, ids.supMotitas);

    // BOHOPHY products - Artesanias de Piel (NO supplier)
    await insertProduct(productIds.keyChain1, 'Key Chain 1', 'unidad', 30, 75, 15, 10, 22, ids.catArtesanias, null);
    await insertProduct(productIds.pielCuadrado, 'Piel cuadrado para marca 4x4 con costura', 'unidad', 20, 50, 10, 10, 22, ids.catArtesanias, null);
    await insertProduct(productIds.pielCuadroGrande, 'Piel cuadro grande 12x12 sin costura', 'unidad', 15, 50, 10, 10, 22, ids.catArtesanias, null);
    await insertProduct(productIds.pielRecuadro, 'Piel recuadro para marca 4x3 con costura', 'unidad', 25, 50, 10, 10, 22, ids.catArtesanias, null);
    await insertProduct(productIds.pielTiraGruesa, 'Piel tira gruesa para Brava Bag 5x40cm', 'unidad', 10, 50, 10, 55, 55, ids.catArtesanias, null);
    await insertProduct(productIds.walletCard, 'Wallet Card Holder 100% Genuine Leather', 'unidad', 40, 75, 15, 80, 160, ids.catArtesanias, null);

    // BOHOPHY products - Bolsas y Accesorios (NO supplier)
    await insertProduct(productIds.rosaritoPremium, 'Rosarito premium', 'unidad', 5, 20, 5, 80, 160, ids.catBolsas, null);
    await insertProduct(productIds.rosaritoWholesale, 'Rosarito wholesale', 'unidad', 3, 20, 5, 70, 140, ids.catBolsas, null);
    await insertProduct(productIds.santoriniAro, 'Santorini aro', 'unidad', 8, 20, 5, 80, 160, ids.catBolsas, null);
    await insertProduct(productIds.santoriniPaleta, 'Santorini paleta', 'unidad', 6, 20, 5, 80, 160, ids.catBolsas, null);
    await insertProduct(productIds.sisalBag, 'Sisal bag large capacity', 'unidad', 4, 15, 3, 90, 180, ids.catBolsas, null);
    await insertProduct(productIds.sobreMarketing, 'Sobre marketing carton', 'unidad', 50, 100, 20, 6, 13, ids.catBolsas, null);
    await insertProduct(productIds.tequilero, 'Tequilero', 'unidad', 7, 20, 5, 30, 60, ids.catBolsas, null);
    await insertProduct(productIds.trancoso, 'Trancoso', 'unidad', 5, 15, 3, 30, 60, ids.catBolsas, null);
    await insertProduct(productIds.treasureBucket, 'Treasure bucket bag hand braided', 'unidad', 3, 10, 2, 150, 300, ids.catBolsas, null);
    await insertProduct(productIds.tulumBag, 'Tulum bag handmade 100% Agave', 'unidad', 2, 10, 2, 150, 300, ids.catBolsas, null);
    await insertProduct(productIds.boraBora, 'Bora Bora premium', 'unidad', 10, 80, 20, 80, 160, ids.catBolsas, null);
    await insertProduct(productIds.zicatelaPremium, 'Zicatela premium', 'unidad', 6, 20, 5, 45, 90, ids.catBolsas, null);
    await insertProduct(productIds.zicatelaWholesale, 'Zicatela wholesale', 'unidad', 4, 20, 5, 70, 140, ids.catBolsas, null);
    await insertProduct(productIds.tableroBg, 'Tablero backgammon piel', 'unidad', 2, 10, 2, 110, 220, ids.catBolsas, null);
    await insertProduct(productIds.yucaCoasters, 'Yuca Coasters', 'unidad', 15, 30, 10, 40, 80, ids.catBolsas, null);

    // BOHOPHY products - Abanicos (NO supplier)
    await insertProduct(productIds.seychellePetit, 'Seychelle Petit Hand fan (Toquilla)', 'unidad', 10, 25, 5, 45, 90, ids.catAbanicos, null);
    await insertProduct(productIds.shelaFan, 'Shela Hand fan (Palm)', 'unidad', 8, 20, 5, 12, 25, ids.catAbanicos, null);

    // ============================================
    // 6. CUSTOMERS
    // ============================================
    console.log('  [6/11] Inserting customers...');
    const customers = [
      [ids.cusTizoc, 'Tizoc', 'tizoc@cliente.com', '+523315551234', 'Cliente frecuente - artesanias de piel'],
      [ids.cusSilvia, 'Silvia', 'silvia@cliente.com', '+523315555678', 'Cliente mayorista'],
      [ids.cusMaria, 'Maria Garcia', 'maria.garcia@gmail.com', '+523316667890', 'Clienta de velas'],
      [ids.cusRoberto, 'Roberto Mendez', 'roberto.mendez@gmail.com', '+523317778901', 'Compra bolsas y accesorios'],
      [ids.cusAna, 'Ana Hernandez', 'ana.hdz@gmail.com', '+523318889012', 'Clienta de abanicos'],
    ];

    for (const [cusId, name, email, phone, notes] of customers) {
      await client.query(
        `INSERT INTO customers (
          id, "systemCode", name, email, phone, notes, "businessId", "isActive"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cusId, generateSystemCode('Customer'), name, email, phone, notes, ids.business, true]
      );
    }

    // ============================================
    // 7. ORDER STATUSES
    // ============================================
    console.log('  [7/11] Inserting order statuses...');
    const orderStatuses = [
      [ids.osPendiente, 'PENDIENTE', '#f59e0b', 'Pedido pendiente de entrega', 1, false, true],
      [ids.osConAnticipo, 'CON ANTICIPO', '#3b82f6', 'Pedido con anticipo recibido', 2, false, false],
      [ids.osPagado, 'PAGADO', '#22c55e', 'Pedido totalmente pagado', 3, false, false],
      [ids.osEntregado, 'ENTREGADO', '#10b981', 'Pedido entregado al cliente', 4, true, false],
      [ids.osCancelado, 'CANCELADO', '#ef4444', 'Pedido cancelado', 5, true, false],
    ];

    for (const [osId, name, color, description, sortOrder, isFinal, isDefault] of orderStatuses) {
      await client.query(
        `INSERT INTO order_statuses (
          id, "systemCode", name, color, description, "businessId", "sortOrder", "isFinal", "isDefault", "isActive"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [osId, generateSystemCode('OrderStatus'), name, color, description, ids.business, sortOrder, isFinal, isDefault, true]
      );
    }

    // ============================================
    // 8. ORDERS
    // ============================================
    console.log('  [8/11] Inserting orders...');

    // Order 1 - TIZOC (5 Feb 2026)
    const order1Items = [
      { productId: productIds.keyChain1, productName: 'Key Chain 1', quantity: 75, unitPrice: 50, total: 3750 },
      { productId: productIds.pielCuadrado, productName: 'Piel cuadrado para marca 4x4 con costura', quantity: 50, unitPrice: 10, total: 500 },
      { productId: productIds.pielRecuadro, productName: 'Piel recuadro para marca 4x3 con costura', quantity: 50, unitPrice: 10, total: 500 },
      { productId: productIds.pielCuadroGrande, productName: 'Piel cuadro grande 12x12 sin costura (Catchall Tray)', quantity: 50, unitPrice: 120, total: 6000 },
      { productId: productIds.walletCard, productName: 'Wallet Card Holder 100% Genuine Leather', quantity: 75, unitPrice: 122.67, total: 9200.25 },
    ];
    const order1Subtotal = order1Items.reduce((sum, item) => sum + item.total, 0);
    const order1Total = order1Subtotal; // 19950.25 ~ 19950
    const order1TotalPaid = 9975; // 50% anticipo

    await client.query(
      `INSERT INTO orders (
        id, "systemCode", "businessId", "customerId", "statusId",
        subtotal, total, "totalPaid", notes, "createdById", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ids.order1, generateSystemCode('Order'), ids.business, ids.cusTizoc, ids.osPendiente,
        order1Subtotal, order1Total, order1TotalPaid,
        'Pedido de artesanias de piel - 5 Feb 2026',
        ids.ownerUser, '2026-02-05T10:00:00.000Z',
      ]
    );

    // Order 1 items
    for (const item of order1Items) {
      await client.query(
        `INSERT INTO order_items (
          id, "orderId", "productId", "productName", quantity, "unitPrice", total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuid(), ids.order1, item.productId, item.productName, item.quantity, item.unitPrice, item.total]
      );
    }

    // Order 1 payment (50% anticipo on Feb 7)
    await client.query(
      `INSERT INTO order_payments (
        id, "systemCode", "orderId", amount, "paymentMethod", notes, "receivedById", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuid(), generateSystemCode('OrderPayment'), ids.order1,
        order1TotalPaid, 'TRANSFER', 'Anticipo 50% - Sabado 7 Feb',
        ids.ownerUser, '2026-02-07T14:00:00.000Z',
      ]
    );

    // Order 2 - SILVIA (11 Feb 2026)
    const order2Total = 12800; // 80 * 160
    const order2TotalPaid = 6400; // 50% anticipo

    await client.query(
      `INSERT INTO orders (
        id, "systemCode", "businessId", "customerId", "statusId",
        subtotal, total, "totalPaid", notes, "createdById", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ids.order2, generateSystemCode('Order'), ids.business, ids.cusSilvia, ids.osConAnticipo,
        order2Total, order2Total, order2TotalPaid,
        'Pedido mayorista Bora Bora premium',
        ids.ownerUser, '2026-02-11T09:00:00.000Z',
      ]
    );

    // Order 2 item
    await client.query(
      `INSERT INTO order_items (
        id, "orderId", "productId", "productName", quantity, "unitPrice", total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuid(), ids.order2, productIds.boraBora, 'Bora Bora premium', 80, 160, 12800]
    );

    // Order 2 payment (50% anticipo)
    await client.query(
      `INSERT INTO order_payments (
        id, "systemCode", "orderId", amount, "paymentMethod", notes, "receivedById", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuid(), generateSystemCode('OrderPayment'), ids.order2,
        order2TotalPaid, 'TRANSFER', 'Anticipo 50%',
        ids.ownerUser, '2026-02-11T09:30:00.000Z',
      ]
    );

    // ============================================
    // 9. TASKS
    // ============================================
    console.log('  [9/11] Inserting tasks...');
    const tasks = [
      ['Preparar pedido Tizoc - 75 Key chains', null, 'PENDING', 'HIGH', '2026-02-15T00:00:00.000Z', null],
      ['Contactar Empack por catalogos', null, 'PENDING', 'MEDIUM', '2026-02-20T00:00:00.000Z', null],
      ['Pedir velas a Fernanda (stock bajo)', null, 'PENDING', 'HIGH', '2026-02-14T00:00:00.000Z', null],
      ['Preparar pedido Silvia - 80 Bora Bora', null, 'IN_PROGRESS', 'HIGH', '2026-02-18T00:00:00.000Z', null],
      ['Inventario mensual febrero', null, 'PENDING', 'LOW', '2026-02-28T00:00:00.000Z', null],
      ['Revisar etiquetas QR con proveedor', null, 'COMPLETED', 'MEDIUM', '2026-02-10T00:00:00.000Z', '2026-02-10T00:00:00.000Z'],
      ['Actualizar catalogo online', null, 'PENDING', 'MEDIUM', '2026-02-25T00:00:00.000Z', null],
    ];

    for (const [title, description, status, priority, dueDate, completedAt] of tasks) {
      await client.query(
        `INSERT INTO tasks (
          id, "systemCode", title, description, "businessId", "assignedToId",
          "createdById", status, priority, "dueDate", "completedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          uuid(), generateSystemCode('Task'), title, description, ids.business,
          ids.ownerUser, ids.ownerUser, status, priority, dueDate, completedAt,
        ]
      );
    }

    // ============================================
    // 10. STOCK MOVEMENTS (initial load for some products)
    // ============================================
    console.log('  [10/11] Inserting stock movements...');

    const stockMovements = [
      // Some key products with initial stock load
      { productId: productIds.velaConchLima, quantity: 14, reason: 'Carga inicial de inventario - Vela Concha Lima' },
      { productId: productIds.velaConchPatch, quantity: 14, reason: 'Carga inicial de inventario - Vela Concha Patchuly' },
      { productId: productIds.cajaZica, quantity: 198, reason: 'Carga inicial de inventario - Caja Marketing ZICA' },
      { productId: productIds.cajaRosa, quantity: 200, reason: 'Carga inicial de inventario - Caja Marketing ROSA' },
      { productId: productIds.keyChain1, quantity: 30, reason: 'Carga inicial de inventario - Key Chain 1' },
      { productId: productIds.walletCard, quantity: 40, reason: 'Carga inicial de inventario - Wallet Card Holder' },
      { productId: productIds.boraBora, quantity: 10, reason: 'Carga inicial de inventario - Bora Bora premium' },
      { productId: productIds.tarjetasVIP, quantity: 191, reason: 'Carga inicial de inventario - Tarjetas VIP' },
      { productId: productIds.telaMantequilla, quantity: 70, reason: 'Carga inicial de inventario - Tela mantequilla' },
      { productId: productIds.sobresArtesana, quantity: 68, reason: 'Carga inicial de inventario - Sobres artesana' },
      { productId: productIds.sobreMarketing, quantity: 50, reason: 'Carga inicial de inventario - Sobre marketing carton' },
      { productId: productIds.seychellePetit, quantity: 10, reason: 'Carga inicial de inventario - Seychelle Petit Hand fan' },
    ];

    for (const mov of stockMovements) {
      await client.query(
        `INSERT INTO stock_movements (
          id, "systemCode", "productId", "businessId", type, quantity,
          "previousStock", "newStock", reason, reference, "performedById", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          uuid(), generateSystemCode('StockMovement'), mov.productId, ids.business,
          'IN', mov.quantity, 0, mov.quantity, mov.reason,
          'CARGA-INICIAL', ids.ownerUser, '2026-02-01T08:00:00.000Z',
        ]
      );
    }

    // ============================================
    // 11. COMMIT
    // ============================================
    console.log('  [11/11] Committing transaction...');
    await client.query('COMMIT');

    console.log('');
    console.log('=== SEED COMPLETED SUCCESSFULLY ===');
    console.log('');
    console.log('Business: BOHOPHY');
    console.log(`  ID: ${ids.business}`);
    console.log('');
    console.log('Users created:');
    console.log(`  Owner:    fernanda@bohophy.com / Bohophy123!`);
    console.log(`  Employee: carlos@bohophy.com   / Bohophy123!`);
    console.log('');
    console.log('Data summary:');
    console.log(`  Categories:      ${categories.length}`);
    console.log(`  Suppliers:       ${suppliers.length}`);
    console.log(`  Products:        ${productNames.length}`);
    console.log(`  Customers:       ${customers.length}`);
    console.log(`  Order Statuses:  ${orderStatuses.length}`);
    console.log(`  Orders:          2`);
    console.log(`  Tasks:           ${tasks.length}`);
    console.log(`  Stock Movements: ${stockMovements.length}`);

  } catch (error) {
    console.error('ERROR during seed:', error.message);
    console.error('Rolling back transaction...');
    try {
      await client.query('ROLLBACK');
      console.error('Transaction rolled back.');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

seed();
