# Migración Frontend - Visualizador de Rutas v1

## Resumen del Cambio
El backend ahora es responsable de procesar rutas. El frontend debe:
1. Consumir endpoints de API ya existentes
2. Dejar de procesar Excel en el navegador
3. Usar nuevos nombres de campos (camelCase)
4. Dejar de usar aliases viejos

---

## Endpoints Disponibles

### 1. Descubrimiento de Fechas (NUEVO - Requerido para llenar selector)
```
GET /api/visualizador/rutas/fechas
```
**Respuesta:**
```json
[
  {
    "fecha": "2026-05-05",
    "totalRutas": 12
  },
  {
    "fecha": "2026-05-04",
    "totalRutas": 8
  }
]
```
**Uso:** Llamar al inicio para llenar el selector de fechas.

---

### 2. Lista de Rutas por Fecha
```
GET /api/visualizador/rutas?fecha=YYYY-MM-DD&vendedor=ABC&limite=100
```
**Parámetros:**
- `fecha` (obligatorio): YYYY-MM-DD
- `vendedor` (opcional): ID del vendedor
- `limite` (opcional, default 100): Max 500

**Respuesta:** Array de rutas resumidas (cada una con la estructura v1).

---

### 3. Detalle Completo de una Ruta
```
GET /api/visualizador/rutas/:id_ruta?incluirClientes=true&minStopDuration=5
```
**Parámetros:**
- `incluirClientes` (opcional, default true): Incluir clientes del vendedor
- `minStopDuration` (opcional, default 5): Minutos mínimos para detectar parada

**Respuesta:** Objeto completo con estructura v1 (ver abajo).

---

### 4. Procesar Excel en Backend
```
POST /api/visualizador/rutas/excel
Content-Type: multipart/form-data

Campo: archivoExcel (archivo .xlsx)
Parámetros query: ?incluirClientes=true&minStopDuration=5
```
**Respuesta:** Misma estructura v1, pero con `source: 'excel-file'` e `idRuta: null`.

---

### 5. Clientes (SIN CAMBIOS - Producción)
```
GET /api/clientes
```
**Respuesta:** Array de clientes con campo `ciudad` (mantener como está).

---

## Contrato v1 - Estructura Completa

Respuesta de `GET /api/visualizador/rutas/:id_ruta`:

```json
{
  "idRuta": 123,
  "fecha": "2026-05-05",
  "vendedor": "ABC",
  "nombreVendedor": "Vendedor Uno",
  "vehiculo": "XYZ-123",
  "descripcion": "Nissan NP300",
  "events": [
    {
      "id": 1,
      "rawIndex": 0,
      "time": "08:00:00",
      "description": "Inicio de Viaje",
      "speed": 10,
      "lat": 32.5,
      "lng": -116.9,
      "odo": 1000
    }
  ],
  "path": [
    {
      "lat": 32.5,
      "lng": -116.9,
      "time": "08:00:00",
      "speed": 10,
      "odo": 1000
    }
  ],
  "flags": [
    {
      "type": "trip_start",
      "lat": 32.5,
      "lng": -116.9,
      "time": "08:00:00",
      "source": "viajes-table"
    },
    {
      "type": "stop",
      "lat": 32.501,
      "lng": -116.901,
      "time": "08:15:00",
      "durationMin": 7,
      "source": "speed-threshold"
    },
    {
      "type": "trip_end",
      "lat": 32.6,
      "lng": -117.0,
      "time": "17:00:00",
      "source": "viajes-table"
    }
  ],
  "viajesAnaliticos": [
    {
      "hora_inicio": "08:00:00",
      "latitud_inicio": 32.5,
      "longitud_inicio": -116.9,
      "hora_fin": "17:00:00",
      "latitud_final": 32.6,
      "longitud_final": -117.0
    }
  ],
  "summary": {
    "totalDistanceKm": 82.356,
    "totalDistanceMeters": 82356.28,
    "workStartTime": "06:13:40",
    "workEndTime": "17:14:30",
    "isTripOngoing": true,
    "processingMethod": "backend-processed"
  },
  "clients": [
    {
      "key": "C001",
      "branchNumber": "0",
      "name": "Cliente Uno",
      "vendor": "ABC",
      "lat": 32.501,
      "lng": -116.901
    }
  ],
  "source": "database"
}
```

### Definición de Campos Clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idRuta` | number | ID único de la ruta. **Null cuando viene de Excel.** |
| `fecha` | string | Formato YYYY-MM-DD |
| `events` | array | Todos los eventos GPS con hora y velocidad |
| `path` | array | Puntos para dibujar línea en mapa (lat, lng, time, speed, odo) |
| `flags` | array | Marcadores especiales: `trip_start`, `trip_end`, `stop` |
| `flags[].durationMin` | number | Duración en minutos (solo para tipo `stop`) |
| `summary.totalDistanceKm` | number | Distancia total recorrida en km |
| `summary.workStartTime` | string | Hora de inicio de labores (HH:MM:SS) |
| `summary.workEndTime` | string | Hora de fin de labores (HH:MM:SS) |
| `summary.isTripOngoing` | boolean | ¿La ruta está en progreso? |
| `clients` | array | Clientes asociados al vendedor (solo si `incluirClientes=true`) |
| `source` | string | `database` o `excel-file` |

---

## Flujo Esperado en Frontend

### Flujo Principal (Server-First)
```
1. Al cargar: GET /api/visualizador/rutas/fechas
   ↓
   Llenar selector de fechas con response

2. Usuario selecciona fecha:
   GET /api/visualizador/rutas?fecha=2026-05-05&limite=20
   ↓
   Mostrar lista de rutas en tabla/grid

3. Usuario selecciona una ruta:
   GET /api/visualizador/rutas/123?incluirClientes=true
   ↓
   Renderizar mapa con path y flags
   Mostrar panel de resumen con datos de summary
   Mostrar tabla de clientes
```

### Flujo Opcional (Excel)
```
1. Usuario sube archivo Excel:
   POST /api/visualizador/rutas/excel
   Body: multipart/form-data { archivoExcel: File }
   ↓
   Backend parsea, procesa y devuelve ruta con source: 'excel-file'

2. Renderizar igual que flujo principal, pero sin `idRuta`
```

---

## Cambios Requeridos en Frontend

### Nombres de Campos (Migración)

**Antes:**
```javascript
const { id_ruta, eventos, routes, paradas, resumen, clientes } = ruta;
```

**Ahora:**
```javascript
const { idRuta, events, path, flags, summary, clients } = ruta;
```

### Dibujo de Mapa

**Antes:** (si lo hacías en frontend)
```javascript
const path = calculatePath(excelData); // Frontend hacía esto
drawMap(path);
```

**Ahora:**
```javascript
const ruta = await fetch('/api/visualizador/rutas/123').then(r => r.json());
drawMap(ruta.path); // Backend ya lo preparó
```

### Resumen de Ruta

**Antes:**
```javascript
const resumen = ruta.summary;
const { totalDistance, workStartTime, workEndTime } = resumen;
```

**Ahora:**
```javascript
const summary = ruta.summary;
const { totalDistanceKm, totalDistanceMeters, workStartTime, workEndTime, isTripOngoing } = summary;
```

### Procesamiento de Excel

**Antes:**
```javascript
const reader = new FileReader();
reader.onload = (e) => {
  const data = parseExcelInFrontend(e.target.result);
  const ruta = transformDataToVisualizable(data); // Todo aquí
  drawMap(ruta);
};
```

**Ahora:**
```javascript
const formData = new FormData();
formData.append('archivoExcel', file);
const ruta = await fetch('/api/visualizador/rutas/excel', {
  method: 'POST',
  body: formData
}).then(r => r.json());
drawMap(ruta.path); // Backend lo hizo
```

---

## Checklist de Integración

- [ ] Consumir `/api/visualizador/rutas/fechas` al cargar la aplicación
- [ ] Llenar selector de fechas dinámicamente
- [ ] Cambiar consumo de rutas a `/api/visualizador/rutas?fecha=...`
- [ ] Cambiar consumo de detalle a `/api/visualizador/rutas/:id_ruta`
- [ ] Actualizar nombres de campos: `id_ruta` → `idRuta`, `eventos` → `events`, etc.
- [ ] Remover lógica de cálculo de distancia (backend la hace)
- [ ] Remover lógica de detección de paradas (backend la hace)
- [ ] Remover parser de Excel en frontend
- [ ] Reemplazar upload de Excel con POST a `/api/visualizador/rutas/excel`
- [ ] Adaptar mapa para usar `path` directamente
- [ ] Adaptar paneles de resumen para usar `summary`
- [ ] Mantener `/api/clientes` sin cambios (producción)
- [ ] Validar que `source` es `database` o `excel-file` para UX
- [ ] Hacer prueba end-to-end con una ruta de BD y una de Excel

---

## Consideraciones

### Base de Datos
- Las rutas de BD tienen `idRuta`, `viajesAnaliticos` completo, vendedor conocido.
- Respuesta más rápida y confiable.

### Excel
- Las rutas de Excel tienen `idRuta: null` (no se guardan).
- Ideal para pruebas, demos, o análisis puntual.
- Misma estructura de `events`, `path`, `flags`, `summary`.

### Clientes
- El endpoint `/api/clientes` no cambia (está en producción).
- Mantener consumo como está hoy.

---

## Validación

El backend está validado con:
- ✅ Tests unitarios (mapper)
- ✅ Tests de integración (BD real)
- ✅ Endpoints funcionando

El frontend debe validar:
- ✅ Selector de fechas se llena correctamente
- ✅ Lista de rutas aparece al seleccionar fecha
- ✅ Detalle de ruta carga sin errores
- ✅ Mapa dibuja con datos de `path`
- ✅ Resumen muestra datos de `summary`
- ✅ Upload de Excel funciona
