-- Script para migrar datos de 'role' a 'roles' en la tabla users
-- Ejecutar DESPUÉS de que TypeORM cree la nueva columna 'roles'

-- 1. Verificar estado actual de la tabla
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('role', 'roles');

-- 2. Si la columna 'role' aún existe y 'roles' está vacía, migrar los datos
-- NOTA: simple-array de TypeORM guarda como string separado por comas
UPDATE users
SET roles = role
WHERE roles IS NULL OR roles = '';

-- 3. Verificar la migración
SELECT id, email, roles FROM users LIMIT 10;

-- 4. (Opcional) Si quieres eliminar la columna 'role' después de verificar
-- CUIDADO: Solo ejecutar después de verificar que los datos están correctos
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
