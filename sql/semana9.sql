-- =========================================================
-- SEMANA 9 - Caso 11: citas_essalud (se puede ejecutar completo)
-- No borra datos. Es seguro repetirlo.
-- =========================================================

-- 0) Tu tabla pasa a llamarse citas_essalud (si aún se llama citas)
DO $$
BEGIN
  IF to_regclass('public.citas') IS NOT NULL AND to_regclass('public.citas_essalud') IS NULL THEN
    ALTER TABLE citas RENAME TO citas_essalud;
  END IF;
END $$;

-- 1) Roles (incluye cajero) y DNI
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente';
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('cliente', 'administrador', 'empleado', 'cajero'));
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dni VARCHAR(8);

-- 2) Columnas de la tabla propia: dueño, estado, tarifa y cobro
ALTER TABLE citas_essalud
  ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'registrado',
  ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS tipo_asegurado VARCHAR(16) NOT NULL DEFAULT 'titular'
      CHECK (tipo_asegurado IN ('titular', 'derechohabiente')),
  ADD COLUMN IF NOT EXISTS monto_calculado NUMERIC(10,2) NOT NULL DEFAULT 0
      CHECK (monto_calculado >= 0),
  ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente'
      CHECK (estado_pago IN ('pendiente', 'pagado', 'exonerado')),
  ADD COLUMN IF NOT EXISTS canal_pago VARCHAR(10)
      CHECK (canal_pago IN ('pasarela', 'caja')),
  ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMPTZ;

-- 3) Entidad emisora simulada (banco y billeteras)
CREATE TABLE IF NOT EXISTS banco_cuentas (
  id               SERIAL PRIMARY KEY,
  numero_cuenta    VARCHAR(20) UNIQUE NOT NULL,
  titular          VARCHAR(100) NOT NULL,
  tipo             VARCHAR(10) NOT NULL CHECK (tipo IN ('ahorros', 'credito')),
  saldo_disponible NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (saldo_disponible >= 0),
  moneda           CHAR(3) NOT NULL DEFAULT 'PEN'
);

CREATE TABLE IF NOT EXISTS banco_tarjetas (
  id        SERIAL PRIMARY KEY,
  numero    VARCHAR(19) UNIQUE NOT NULL,
  id_cuenta INT NOT NULL REFERENCES banco_cuentas(id),
  titular   VARCHAR(100) NOT NULL,
  marca     VARCHAR(20) NOT NULL,
  tipo      VARCHAR(10) NOT NULL CHECK (tipo IN ('debito', 'credito')),
  mes_venc  SMALLINT NOT NULL CHECK (mes_venc BETWEEN 1 AND 12),
  anio_venc SMALLINT NOT NULL,
  cvv       VARCHAR(4) NOT NULL,
  estado    VARCHAR(10) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'bloqueada'))
);

CREATE TABLE IF NOT EXISTS billeteras (
  id                SERIAL PRIMARY KEY,
  proveedor         VARCHAR(12) NOT NULL CHECK (proveedor IN ('andipay', 'pagomovil')),
  celular           VARCHAR(9) NOT NULL,
  titular           VARCHAR(100) NOT NULL,
  saldo_disponible  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (saldo_disponible >= 0),
  codigo_aprobacion VARCHAR(6) NOT NULL,
  UNIQUE (proveedor, celular)
);

-- 4) Pagos del comercio (auditoría)
CREATE TABLE IF NOT EXISTS pagos (
  id                  SERIAL PRIMARY KEY,
  codigo_operacion    VARCHAR(20) UNIQUE NOT NULL,
  id_registro         INT NOT NULL REFERENCES citas_essalud(id),
  id_usuario          INT REFERENCES usuarios(id),
  canal               VARCHAR(10) NOT NULL CHECK (canal IN ('pasarela', 'caja')),
  metodo              VARCHAR(20) NOT NULL
                      CHECK (metodo IN ('tarjeta_debito', 'tarjeta_credito', 'billetera', 'efectivo', 'pos')),
  proveedor_billetera VARCHAR(12) CHECK (proveedor_billetera IN ('andipay', 'pagomovil')),
  marca_tarjeta       VARCHAR(20),
  referencia          VARCHAR(30),
  monto               NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  monto_recibido      NUMERIC(10,2),
  vuelto              NUMERIC(10,2),
  estado              VARCHAR(10) NOT NULL CHECK (estado IN ('aprobado', 'rechazado')),
  motivo_rechazo      VARCHAR(120),
  id_cajero           INT REFERENCES usuarios(id),
  verificado          BOOLEAN NOT NULL DEFAULT false,
  verificado_por      INT REFERENCES usuarios(id),
  fecha_verificacion  TIMESTAMPTZ,
  fecha_pago          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_un_aprobado_por_registro
  ON pagos (id_registro) WHERE estado = 'aprobado';

-- 5.1) Cuentas, tarjetas y billeteras de prueba
INSERT INTO banco_cuentas (numero_cuenta, titular, tipo, saldo_disponible) VALUES
  ('0011-000001', 'ANA TORRES QUISPE',  'ahorros', 1500.00),
  ('0011-000002', 'LUIS PEREZ ROJAS',   'ahorros',   10.00),
  ('0022-000001', 'MARIA HUAMAN SOTO',  'credito', 3000.00),
  ('0022-000002', 'JORGE LIMA CRUZ',    'credito', 2000.00),
  ('0011-000003', 'ROSA CCENCHO VEGA',  'ahorros',  800.00)
ON CONFLICT (numero_cuenta) DO NOTHING;

INSERT INTO banco_tarjetas (numero, id_cuenta, titular, marca, tipo, mes_venc, anio_venc, cvv, estado)
SELECT t.numero, c.id, c.titular, t.marca, t.tipo, t.mes, t.anio, t.cvv, t.estado
FROM (VALUES
  ('4111111111111111', '0011-000001', 'Visa',             'debito',  12, 2029, '123',  'activa'),
  ('4000000000000002', '0011-000002', 'Visa',             'debito',   8, 2028, '456',  'activa'),
  ('5555555555554444', '0022-000001', 'Mastercard',       'credito',  5, 2030, '789',  'activa'),
  ('5105105105105100', '0022-000002', 'Mastercard',       'credito',  3, 2027, '321',  'bloqueada'),
  ('378282246310005',  '0022-000001', 'American Express', 'credito', 11, 2028, '1234', 'activa'),
  ('4242424242424242', '0011-000003', 'Visa',             'debito',   1, 2025, '111',  'activa')
) AS t(numero, cuenta, marca, tipo, mes, anio, cvv, estado)
JOIN banco_cuentas c ON c.numero_cuenta = t.cuenta
ON CONFLICT (numero) DO NOTHING;

INSERT INTO billeteras (proveedor, celular, titular, saldo_disponible, codigo_aprobacion) VALUES
  ('andipay',   '987654321', 'ANA TORRES QUISPE',  500.00, '123456'),
  ('pagomovil', '912345678', 'LUIS PEREZ ROJAS',    15.00, '654321'),
  ('andipay',   '999888777', 'MARIA HUAMAN SOTO', 1000.00, '111222')
ON CONFLICT (proveedor, celular) DO NOTHING;

-- 5.2) Usuarios de prueba: 1 administrador, 2 empleados, 2 cajeros, 10 clientes
INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES
  ('Administrador Prueba', 'admin@essalud.pe',     'Admin123', 'administrador'),
  ('Empleado Uno',         'empleado1@essalud.pe', 'Emp12345', 'empleado'),
  ('Empleado Dos',         'empleado2@essalud.pe', 'Emp12345', 'empleado'),
  ('Cajera de Turno',      'caja@correo.com',      '1234',     'cajero'),
  ('Cajero Dos',           'caja2@correo.com',     '1234',     'cajero')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (nombre, correo, contrasena, rol)
SELECT 'Cliente ' || n, 'cliente' || n || '@correo.com', 'Cliente123', 'cliente'
FROM generate_series(1, 10) AS n
ON CONFLICT (correo) DO NOTHING;

UPDATE usuarios SET dni = (70000000 + id)::text WHERE rol = 'cliente' AND dni IS NULL;

-- 5.3) Citas de prueba (3 por cliente de prueba) y montos con la regla del caso 11
INSERT INTO citas_essalud (codigo_seguimiento, numero_asegurado, nombre_paciente, sede,
                           tipo_asegurado, monto_calculado, id_usuario, estado)
SELECT 'COD-' || LPAD((u.id * 10 + k)::text, 8, '0'),
       LPAD((1000 + u.id)::text, 4, '0'),
       u.nombre,
       (ARRAY['Hospital Huacho', 'Hospital Barranca', 'Hospital Huaral'])[k],
       CASE WHEN k = 2 THEN 'derechohabiente' ELSE 'titular' END,
       CASE WHEN k = 2 THEN 18.00 ELSE 10.00 END,
       u.id, 'registrado'
FROM usuarios u CROSS JOIN generate_series(1, 3) AS k
WHERE u.correo LIKE 'cliente%@correo.com'
  AND NOT EXISTS (SELECT 1 FROM citas_essalud c WHERE c.id_usuario = u.id);

-- Tus citas anteriores: tipo de asegurado y monto (titular 10, derechohabiente 18)
UPDATE citas_essalud
SET tipo_asegurado = CASE WHEN id % 2 = 0 THEN 'derechohabiente' ELSE 'titular' END
WHERE monto_calculado = 0 AND id_usuario IS NULL;

UPDATE citas_essalud
SET monto_calculado = CASE tipo_asegurado WHEN 'derechohabiente' THEN 18.00 ELSE 10.00 END
WHERE monto_calculado = 0;

-- 5.4) Pagos ya realizados: 4 por pasarela, 2 en caja y 1 rechazado
WITH elegidos AS (
  SELECT r.id, r.id_usuario, r.monto_calculado,
         ROW_NUMBER() OVER (ORDER BY r.id) AS n
  FROM citas_essalud r
  WHERE r.estado_pago = 'pendiente' AND r.id_usuario IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pagos WHERE codigo_operacion LIKE 'OP-SEED-%')
  ORDER BY r.id
  LIMIT 6
)
INSERT INTO pagos (codigo_operacion, id_registro, id_usuario, canal, metodo, proveedor_billetera,
                   marca_tarjeta, referencia, monto, monto_recibido, vuelto, estado, id_cajero)
SELECT
  'OP-SEED-' || LPAD(n::text, 3, '0'),
  id, id_usuario,
  CASE WHEN n <= 4 THEN 'pasarela' ELSE 'caja' END,
  (ARRAY['tarjeta_debito', 'tarjeta_credito', 'billetera', 'billetera', 'efectivo', 'pos'])[n],
  CASE n WHEN 3 THEN 'andipay' WHEN 4 THEN 'pagomovil' END,
  CASE n WHEN 1 THEN 'Visa' WHEN 2 THEN 'Mastercard' END,
  CASE n WHEN 1 THEN '**** 1111' WHEN 2 THEN '**** 4444' WHEN 3 THEN '*** *** 321'
         WHEN 4 THEN '*** *** 678' WHEN 5 THEN 'Efectivo' ELSE 'Voucher 004512' END,
  monto_calculado,
  CASE WHEN n = 5 THEN CEIL(monto_calculado / 10) * 10 END,
  CASE WHEN n = 5 THEN CEIL(monto_calculado / 10) * 10 - monto_calculado END,
  'aprobado',
  CASE WHEN n > 4 THEN (SELECT id FROM usuarios WHERE rol = 'cajero' ORDER BY id LIMIT 1) END
FROM elegidos;

UPDATE citas_essalud r
SET estado_pago = 'pagado', canal_pago = p.canal, fecha_pago = p.fecha_pago
FROM pagos p
WHERE p.id_registro = r.id AND p.estado = 'aprobado';

INSERT INTO pagos (codigo_operacion, id_registro, id_usuario, canal, metodo, marca_tarjeta,
                   referencia, monto, estado, motivo_rechazo)
SELECT 'RCH-SEED-001', r.id, r.id_usuario, 'pasarela', 'tarjeta_debito', 'Visa',
       '**** 0002', r.monto_calculado, 'rechazado', 'Saldo insuficiente en la cuenta de ahorros.'
FROM citas_essalud r
WHERE r.estado_pago = 'pendiente' AND r.id_usuario IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pagos WHERE codigo_operacion = 'RCH-SEED-001')
ORDER BY r.id DESC
LIMIT 1;

-- 6) Verificación (captura obligatoria)
SELECT rol, COUNT(*) FROM usuarios GROUP BY rol ORDER BY rol;

SELECT estado_pago, canal_pago, COUNT(*) AS registros, SUM(monto_calculado) AS total
FROM citas_essalud GROUP BY estado_pago, canal_pago ORDER BY estado_pago;

SELECT canal, metodo, estado, COUNT(*) AS operaciones, SUM(monto) AS total
FROM pagos GROUP BY canal, metodo, estado ORDER BY canal, metodo, estado;
