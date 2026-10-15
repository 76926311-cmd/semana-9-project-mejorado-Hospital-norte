-- 1) Columnas nuevas (no borra datos)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente'
  CHECK (rol IN ('cliente', 'administrador', 'empleado'));

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'registrado';

-- 2) Casos de prueba: 1 administrador y 2 empleados
INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES
  ('Administrador Prueba', 'admin@essalud.pe',     'Admin123', 'administrador'),
  ('Empleado Uno',         'empleado1@essalud.pe', 'Emp12345', 'empleado'),
  ('Empleado Dos',         'empleado2@essalud.pe', 'Emp12345', 'empleado');

-- 3) 10 clientes de prueba (clave: Cliente123)
INSERT INTO usuarios (nombre, correo, contrasena, rol)
SELECT 'Cliente ' || n, 'cliente' || n || '@correo.com', 'Cliente123', 'cliente'
FROM generate_series(1, 10) AS n;

-- 4) 3 citas por cada cliente de prueba (30 en total)
INSERT INTO citas (codigo_seguimiento, numero_asegurado, nombre_paciente, sede, id_usuario, estado)
SELECT 'COD-' || LPAD((u.id * 10 + k)::text, 8, '0'),
       LPAD((1000 + u.id)::text, 4, '0'),
       u.nombre,
       (ARRAY['Hospital Huacho', 'Hospital Barranca', 'Hospital Huaral'])[k],
       u.id, 'registrado'
FROM usuarios u CROSS JOIN generate_series(1, 3) AS k
WHERE u.correo LIKE 'cliente%@correo.com';

-- 5) Para la captura
SELECT rol, COUNT(*) FROM usuarios GROUP BY rol;
SELECT id_usuario, COUNT(*) FROM citas GROUP BY id_usuario ORDER BY id_usuario;
