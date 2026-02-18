#!/bin/bash

# Script para iniciar el proyecto con una sola instancia
# Cierra instancias previas y inicia una nueva instancia limpia

PROJECT_NAME="modular-base-architecture"
DEFAULT_PORT=3001

echo "🔍 Verificando instancias previas del proyecto $PROJECT_NAME..."

# 1. Buscar y matar procesos específicos del proyecto
echo "📋 Buscando procesos del proyecto..."
PIDS=$(ps aux | grep "$PROJECT_NAME" | grep -v grep | awk '{print $2}')

if [ ! -z "$PIDS" ]; then
    echo "⚠️  Encontradas instancias previas del proyecto:"
    ps aux | grep "$PROJECT_NAME" | grep -v grep
    echo "🔄 Cerrando instancias previas..."
    echo $PIDS | xargs kill -9 2>/dev/null || true
    sleep 2
    echo "✅ Instancias previas cerradas"
else
    echo "✅ No hay instancias previas del proyecto ejecutándose"
fi

# 2. Verificar puertos ocupados por el proyecto
echo "🔍 Verificando puertos 3000-3005..."
for port in {3000..3005}; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        PID=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1)
        PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")

        # Si el proceso contiene "node" y está en nuestro directorio de proyecto
        if ps -p $PID -o args= 2>/dev/null | grep -q "$PROJECT_NAME"; then
            echo "⚠️  Puerto $port ocupado por nuestro proyecto (PID: $PID)"
            kill -9 $PID 2>/dev/null || true
            echo "🔄 Proceso $PID terminado"
        else
            echo "ℹ️  Puerto $port ocupado por otro proyecto ($PROCESS_NAME - PID: $PID)"
        fi
    fi
done

# 3. Encontrar un puerto libre
echo "🔍 Buscando puerto libre..."
PORT=$DEFAULT_PORT
while netstat -tlnp 2>/dev/null | grep -q ":$PORT "; do
    echo "⚠️  Puerto $PORT ocupado, probando siguiente..."
    PORT=$((PORT + 1))
    if [ $PORT -gt 3010 ]; then
        echo "❌ No se encontró puerto libre entre 3001-3010"
        exit 1
    fi
done

echo "✅ Puerto libre encontrado: $PORT"

# 4. Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || ! grep -q "$PROJECT_NAME" package.json; then
    echo "❌ Error: No estamos en el directorio del proyecto $PROJECT_NAME"
    echo "📁 Directorio actual: $(pwd)"
    exit 1
fi

# 5. Hacer build del proyecto
echo "🔨 Construyendo proyecto..."
if ! pnpm run build; then
    echo "❌ Error en el build del proyecto"
    exit 1
fi

echo "✅ Build completado exitosamente"

# 6. Iniciar el proyecto
echo "🚀 Iniciando $PROJECT_NAME en puerto $PORT..."
echo "📚 Documentación estará disponible en: http://localhost:$PORT/api/docs"
echo ""

# Usar el puerto encontrado
PORT=$PORT pnpm run start