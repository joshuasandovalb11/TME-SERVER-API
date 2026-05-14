# Backend Visualizador de Rutas

## Objetivo
Este modulo entrega rutas procesadas para que el frontend solo dibuje mapa y paneles. 

**Dos opciones de entrada:**
1. **Ruta desde Base de Datos** (recomendado): El backend obtiene los datos de BD, los procesa y devuelve
2. **Ruta desde Excel** (opcional): El backend recibe un Excel, lo parsea, lo procesa y devuelve (sin guardar en BD)

## Endpoints
### Descubrimiento de Fechas
- `GET /api/visualizador/rutas/fechas` — Devuelve lista de fechas con rutas disponibles
  - **Respuesta:** Array de `{fecha: "YYYY-MM-DD", totalRutas: number}`
  - **Uso:** El frontend consulta esto para llenar el selector de fechas

### Desde Base de Datos
- `GET /api/visualizador/rutas?fecha=YYYY-MM-DD&vendedor=ABC&limite=100` — Lista de rutas resumidas
- `GET /api/visualizador/rutas/:id_ruta?incluirClientes=true&minStopDuration=5` — Detalle de ruta de BD

### Desde Excel (Opcional)
- `POST /api/visualizador/rutas/excel` — Procesa un Excel y devuelve ruta procesada (sin guardar en BD)
  - **Parámetros query:** `?incluirClientes=true&minStopDuration=5`
  - **Body:** `multipart/form-data` con campo `archivoExcel`
  - **Respuesta:** Misma estructura v1 que `/rutas/:id_ruta`, pero con `source: 'excel-file'`

## Flujo de Procesamiento de Excel
```
1. Cliente sube archivo Excel vía POST /api/visualizador/rutas/excel
   ↓
2. Backend recibe y almacena temporalmente en temp_uploads/
   ↓
3. Usa sistema_rutas/utils/parser.js para:
   - Extraer metadatos: placa del vehículo, fecha de ruta
   - Detectar columnas dinámicamente: hora, evento, velocidad, odómetro, lat/lng
   - Parsear eventos: {h, evt, lat, lng, vel, odo}
   - Estructurar viajes analíticos: inicio/fin con coordenadas
   ↓
4. Backend busca el vehículo en BD_RUTAS:
   - Obtiene: id_vendedor, nombre_vendedor, descripción del vehículo
   - Si no existe → Error 404
   ↓
5. Si incluirClientes=true:
   - Consulta la BD remota (PBI) por clientes del vendedor
   - Devuelve puntos GPS de clientes
   ↓
6. Reutiliza ruta_mapper para procesar:
   - Calcula distancia total (Haversine)
   - Detecta paradas (velocidad <= 1 km/h, duración >= minStopDuration)
   - Construye flags: trip_start, trip_end, stop
   - Normaliza horas: HH:MM:SS
   ↓
7. Devuelve estructura v1 limpia (no guarda en BD)
   - Campo adicional: source: 'excel-file'
   - idRuta: null (no tiene ID porque no está en BD)
```

**Ventaja:** El frontend puede visualizar una ruta de un Excel sin inyectarla primero en la BD, ideal para pruebas, demos, o rutas puntales.

## Contrato v1 - Definición limpia (Sin aliases)
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
    }
  ],
  "viajesAnaliticos": [
    {
      "hora_inicio": "08:00:00",
      "latitud_inicio": 32.5,
      "longitud_inicio": -116.9,
      "hora_fin": "08:30:00",
      "latitud_final": 32.6,
      "longitud_final": -117.0
    }
  ],
  "summary": {
    "totalDistanceKm": 12.345,
    "totalDistanceMeters": 12345,
    "workStartTime": "08:00:00",
    "workEndTime": "17:00:00",
    "isTripOngoing": false,
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
  ]
}
```

### Descripción de campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idRuta` | number | ID único de la ruta diaria |
| `fecha` | string | Fecha formato YYYY-MM-DD |
| `vendedor` | string | ID del vendedor |
| `nombreVendedor` | string | Nombre completo del vendedor |
| `vehiculo` | string | Placa del vehículo |
| `descripcion` | string | Modelo/descripción del vehículo |
| `events` | array | Lista de eventos (puntos de GPS con información asociada) |
| `events[].id` | number | Índice secuencial del evento |
| `events[].rawIndex` | number | Índice original en datos comprimidos |
| `events[].time` | string | Hora formato HH:MM:SS |
| `events[].description` | string | Tipo de evento (ej: "Inicio de Viaje", "Parado") |
| `events[].speed` | number | Velocidad en km/h |
| `events[].lat` | number | Latitud |
| `events[].lng` | number | Longitud |
| `events[].odo` | number | Odómetro en km |
| `path` | array | Lista de puntos para trazar ruta en mapa |
| `path[].lat` | number | Latitud |
| `path[].lng` | number | Longitud |
| `path[].time` | string | Hora formato HH:MM:SS |
| `path[].speed` | number | Velocidad en km/h |
| `path[].odo` | number | Odómetro |
| `flags` | array | Eventos especiales (inicio/fin de viajes, paradas detectadas) |
| `flags[].type` | string | Tipo: `trip_start`, `trip_end`, `stop` |
| `flags[].lat` | number | Latitud |
| `flags[].lng` | number | Longitud |
| `flags[].time` | string | Hora formato HH:MM:SS |
| `flags[].durationMin` | number | Duración en minutos (solo para stops) |
| `flags[].source` | string | Origen: `viajes-table`, `speed-threshold` |
| `viajesAnaliticos` | array | Viajes analíticos de BD (hora_inicio, latitud_inicio, etc.) |
| `summary` | object | Resumen estadístico de la ruta |
| `summary.totalDistanceKm` | number | Distancia total en km |
| `summary.totalDistanceMeters` | number | Distancia total en metros |
| `summary.workStartTime` | string | Hora de inicio de labores (primer evento con velocidad > 0) |
| `summary.workEndTime` | string | Hora de fin de labores (último evento con velocidad > 0) |
| `summary.isTripOngoing` | boolean | Indica si la ruta sigue en progreso (último evento no es "Fin de Viaje") |
| `summary.processingMethod` | string | Siempre `backend-processed` |
| `clients` | array | Clientes del vendedor con coordenadas GPS |
| `clients[].key` | string | ID único del cliente |
| `clients[].branchNumber` | string | ID de sucursal |
| `clients[].name` | string | Nombre comercial |
| `clients[].vendor` | string | ID del vendedor asociado |
| `clients[].lat` | number | Latitud |
| `clients[].lng` | number | Longitud |
| `source` | string | Origen de los datos: `database` o `excel-file` |

## Nota importante sobre /api/clientes
El endpoint `GET /api/clientes` mantiene su contrato original **SIN CAMBIOS** para no romper la producción:
```json
[
  {
    "key": "C001",
    "branchNumber": "0",
    "name": "Cliente Uno",
    "vendor": "ABC",
    "lat": 32.5,
    "lng": -116.9,
    "ciudad": "Tijuana"
  }
]
```

## Separacion de responsabilidades
- `visualizador_rutas/services/ruta_mapper.js`: transformacion pura (sin DB), calculos y armado de payload.
- `visualizador_rutas/services/rutas.service.js`: IO de DB, validaciones de request y delegacion al mapper.
- `visualizador_rutas/routes/rutas.routes.js`: definicion de rutas HTTP.

## Historial de cambios - v1 (Contrato limpio)
Se eliminaron todos los aliases redundantes. **Cambios principales:**

| Antes (con aliases) | Ahora (v1 limpio) | Notas |
|---------------------|-------------------|-------|
| `id_ruta` | `idRuta` | Cambio a camelCase |
| `eventos` (alias) | Removido | Usar solo `events` |
| `routes: [{ path: [...] }]` | `path: [...]` | Simplificado, ya no es array wrapper |
| `ruta: { path }` (alias) | Removido | Usar solo `path` |
| `paradas` (alias) | Removido | Usar solo `flags` |
| `resumen` (alias) | Removido | Usar solo `summary` |
| `summary.totalDistance` | Removido | Usar solo `totalDistanceKm` |
| `clientes` (alias) | Removido | Usar solo `clients` |
| N/A | `summary` sin `totalDistance` | Eliminada duplicación redundante |

**⚠️ IMPACTO EN FRONTEND:**
El frontend necesitará actualizarse para usar:
- `idRuta` en lugar de `id_ruta`
- `events` directo en lugar de `eventos`
- `path` en lugar de `routes[0].path`
- `flags` en lugar de `paradas`
- `summary.totalDistanceKm` en lugar de `summary.totalDistance` o `resumen.totalDistance`
- `clients` en lugar de `clientes`

**EXCEPCIÓN:** El endpoint `GET /api/clientes` mantiene su contrato sin cambios.

## Pruebas backend
Se agrego suite minima de pruebas unitarias para el mapper:

```bash
npm run test:visualizador
```

Cobertura actual de la prueba:
- normalizacion de hora
- parseo y mapeo de eventos
- construccion del payload final compatible con mapa

## Pruebas manuales HTTP
Con servidor levantado:

### Desde BD
```bash
curl "http://localhost:3001/api/visualizador/rutas?fecha=2026-05-05&limite=20"
curl "http://localhost:3001/api/visualizador/rutas/123?incluirClientes=true&minStopDuration=5"
```

### Desde Excel
```bash
# Sin clientes
curl -X POST \
  -F "archivoExcel=@/path/to/archivo.xlsx" \
  "http://localhost:3001/api/visualizador/rutas/excel"

# Con clientes y minStopDuration personalizado
curl -X POST \
  -F "archivoExcel=@/path/to/archivo.xlsx" \
  "http://localhost:3001/api/visualizador/rutas/excel?incluirClientes=true&minStopDuration=3"
```

**Nota:** El archivo Excel debe tener la misma estructura que genera el GPS nativo (con columnas de Hora, Descripción, Velocidad, Odómetro, Latitud, Longitud).
