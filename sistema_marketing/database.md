# Base de datos: toolspbi

## Estructura general

### 1. CATÁLOGOS
- PAISES
- ESTADOS
- CIUDADES
- COLONIAS
- MARCAS
- ZONAS
- TIPOVEND

### 2. MAESTROS
- CLIENTES
- PROVEEDORES
- VENDEDORES
- SUCURSALES

### 3. OPERATIVOS / CONFIGURACIÓN
- RUTAS
- RUTAS_ENTREGA
- LISTAPRECIOS

### 4. PRODUCTOS
- ARTICULOS_2

### 5. TRANSACCIONALES
- FACTURASCLIE_2
- FACTURASCLIE_ARTICULOS_2
- FACTURASCLIE_PAGOS_2
- FACTURASCLIE_ESTATUS_2
- FACTURASCLIE_SAT_2

## Tabla: PBIT_ARTICULOS_2

**Descripción:**  
Tabla que almacena la información de los productos/artículos del sistema, incluyendo datos de identificación, costos, unidades de medida y configuraciones operativas.

---

### Campos

| Campo                         | Tipo             | Null | Descripción |
|-------------------------------|------------------|------|-------------|
| ID_PRODUCTO                   | INT              | No   | Identificador único del producto (PK). |
| COD_PRODUCTO                  | VARCHAR(50)      | No   | Código único del producto. |
| DESC_PRODUCTO                 | VARCHAR(MAX)     | No   | Descripción o nombre del producto. |
| ID_PORCIVA                    | VARCHAR(MAX)     | Sí   | Identificador del porcentaje de IVA aplicado. |
| ID_DEPTO                      | VARCHAR(MAX)     | Sí   | Identificador del departamento al que pertenece el producto. |
| ID_CLASE                      | VARCHAR(MAX)     | Sí   | Clasificación o categoría del producto. |
| ID_PROVEEDOR                  | VARCHAR(MAX)     | Sí   | Identificador del proveedor del producto. |
| UNIDAD_VENTA                  | VARCHAR(MAX)     | Sí   | Unidad principal de venta. |
| INACTIVO                      | CHAR(2)          | Sí   | Indica si el producto está inactivo. |
| INVENTARIABLE                 | CHAR(2)          | Sí   | Define si el producto maneja inventario. |
| PERMITIR_EXIST_NEGATIVA       | CHAR(2)          | Sí   | Permite existencia negativa en inventario. |
| IMPORTACION                   | CHAR(2)          | Sí   | Indica si el producto es de importación. |
| MONEDA                        | CHAR(3)          | Sí   | Tipo de moneda asociada al producto. |
| CTO_INT                       | DECIMAL(10,4)    | Sí   | Costo interno del producto. |
| CTO_FACT                      | DECIMAL(10,4)    | Sí   | Costo de facturación. |
| FORMA_COSTEO                  | VARCHAR(MAX)     | Sí   | Método de costeo del producto. |
| UPC1                          | VARCHAR(MAX)     | Sí   | Código de barras principal. |
| UPC2                          | VARCHAR(MAX)     | Sí   | Código de barras alternativo. |
| UPC3                          | VARCHAR(MAX)     | Sí   | Código de barras adicional. |
| ID_ZONA                       | VARCHAR(MAX)     | Sí   | Zona geográfica asociada al producto. |
| ID_MARCA                      | INT              | Sí   | Identificador de la marca del producto. |
| UNIDAD_V2                     | VARCHAR(MAX)     | Sí   | Unidad de venta secundaria. |
| UNIDAD_V3                     | VARCHAR(MAX)     | Sí   | Unidad de venta terciaria. |
| UNIDAD_C1                     | VARCHAR(MAX)     | Sí   | Unidad de compra 1. |
| UNIDAD_C2                     | VARCHAR(MAX)     | Sí   | Unidad de compra 2. |
| UNIDAD_C3                     | VARCHAR(MAX)     | Sí   | Unidad de compra 3. |
| UNIDAD_M1                     | VARCHAR(MAX)     | Sí   | Unidad de medida 1. |
| UNIDAD_M2                     | VARCHAR(MAX)     | Sí   | Unidad de medida 2. |
| UNIDAD_M3                     | VARCHAR(MAX)     | Sí   | Unidad de medida 3. |
| MULT_U1                       | INT              | Sí   | Multiplicador de unidad 1. |
| MULT_U2                       | INT              | Sí   | Multiplicador de unidad 2. |
| MULT_U3                       | INT              | Sí   | Multiplicador de unidad 3. |
| UNIDAD_INV                    | VARCHAR(MAX)     | Sí   | Unidad de inventario. |
| CALCULAR_IVA                  | CHAR(2)          | Sí   | Indica si el producto calcula IVA. |
| DESCONTINUADO                 | CHAR(2)          | Sí   | Indica si el producto está descontinuado. |
| ESPECIALIDAD                  | CHAR(2)          | Sí   | Indica si el producto pertenece a una especialidad. |
| NO_IMPRIMIR_EN_LISTAS         | CHAR(2)          | Sí   | Define si el producto se excluye de listados. |
| PART_NUMBER                   | VARCHAR(MAX)     | Sí   | Número de parte del producto. |
| FERRECOPA                     | CHAR(2)          | Sí   | Indicador específico del sistema (validar uso funcional). |

---

**Relaciones lógicas identificadas:**

- ID_PROVEEDOR → Tabla de proveedores (no definida como FK)
- ID_MARCA → Tabla de marcas (no definida como FK)
- ID_DEPTO → Tabla de departamentos (no definida como FK)
- ID_CLASE → Tabla de clases/categorías (no definida como FK)
- ID_ZONA → Tabla de zonas (no definida como FK)
- ID_PORCIVA → Tabla de tipos de IVA (no definida como FK)

---

## Tabla: PBIT_CIUDADES

**Descripción:**  
Tabla que almacena las ciudades registradas en el sistema, permitiendo su asociación con estados o regiones.

---

### Campos

| Campo        | Tipo         | Null | Descripción |
|--------------|--------------|------|-------------|
| ID_CIUDAD    | INT          | No   | Identificador único de la ciudad (PK). |
| NOM_CIUDAD   | VARCHAR(MAX) | No   | Nombre de la ciudad. |
| ID_ESTADO    | INT          | Sí   | Identificador del estado al que pertenece la ciudad. |

---

**Relaciones lógicas identificadas:**

- ID_ESTADO → Tabla de estados o entidades federativas (no definida como FK)

---

## Tabla: PBIT_CLIENTES_2

**Descripción:**  
Tabla que almacena la información de los clientes, incluyendo datos fiscales, comerciales, condiciones de crédito y asignaciones operativas como zonas, vendedores y rutas.

---

### Campos

| Campo                 | Tipo          | Null | Descripción |
|-----------------------|---------------|------|-------------|
| ID_CLIENTE            | INT           | No   | Identificador único del cliente (PK). |
| RAZON                 | VARCHAR(MAX)  | No   | Razón social del cliente. |
| RFC                   | VARCHAR(MAX)  | No   | Registro Federal de Contribuyentes del cliente. |
| CONDICIONES_VENTA     | VARCHAR(10)   | Sí   | Condiciones comerciales de venta. |
| LIMITE_CREDITO        | DECIMAL(10,2) | Sí   | Límite de crédito asignado al cliente. |
| DIAS_CREDITO          | INT           | Sí   | Número de días de crédito otorgados. |
| ID_VEND_1             | VARCHAR(MAX)  | Sí   | Identificador del primer vendedor asignado. |
| ID_VEND_2             | VARCHAR(MAX)  | Sí   | Identificador del segundo vendedor asignado. |
| ID_VEND_3             | VARCHAR(MAX)  | Sí   | Identificador del tercer vendedor asignado. |
| ID_ZONA_1             | INT           | Sí   | Zona principal del cliente. |
| ID_LISTAPRECIOS_1     | INT           | Sí   | Lista de precios principal asignada. |
| ID_ZONA_2             | INT           | Sí   | Zona secundaria del cliente. |
| ID_LISTAPRECIOS_2     | INT           | Sí   | Segunda lista de precios asignada. |
| ID_ZONA_3             | INT           | Sí   | Tercera zona del cliente. |
| ID_LISTAPRECIOS_3     | INT           | Sí   | Tercera lista de precios asignada. |
| AUTORIZAR_DESCUENTOS  | CHAR(2)       | Sí   | Indica si el cliente permite descuentos. |
| CLASIF_DESCUENTO      | CHAR(55)      | Sí   | Clasificación de descuento aplicable. |
| ID_GIRO_COMERCIAL     | INT           | Sí   | Giro comercial del cliente. |
| NOMBRE_COMERCIAL      | VARCHAR(50)   | Sí   | Nombre comercial del cliente. |
| ACTIVO                | CHAR(2)       | Sí   | Indica si el cliente está activo. |
| BLOQUEADO             | CHAR(2)       | Sí   | Indica si el cliente está bloqueado. |
| MOTIVO_BLOQUEO        | VARCHAR(MAX)  | Sí   | Motivo por el cual el cliente fue bloqueado. |
| TIPO_FACTURACION      | INT           | Sí   | Tipo de facturación del cliente. |
| MONEDA                | CHAR(3)       | Sí   | Tipo de moneda utilizada. |
| ID_GRUPO_EMPRESARIAL  | INT           | Sí   | Grupo empresarial al que pertenece el cliente. |
| ID_RUTAVEND           | INT           | Sí   | Ruta de venta asignada. |
| ID_RUTAENTREGA        | INT           | Sí   | Ruta de entrega asignada. |
| ID_PORCIVA            | INT           | Sí   | Identificador del porcentaje de IVA aplicable. |
| GPS_LAT               | VARCHAR(MAX)  | Sí   | Latitud de ubicación del cliente. |
| GPS_LON               | VARCHAR(MAX)  | Sí   | Longitud de ubicación del cliente. |
| CANCELADO             | CHAR(2)       | Sí   | Indica si el cliente está cancelado. |
| CAUSA_BLOQUEO         | VARCHAR(MAX)  | Sí   | Causa del bloqueo del cliente. |

---

**Relaciones lógicas identificadas:**

- ID_VEND_1, ID_VEND_2, ID_VEND_3 → Tabla de vendedores (no definida como FK)
- ID_ZONA_1, ID_ZONA_2, ID_ZONA_3 → Tabla de zonas (no definida como FK)
- ID_LISTAPRECIOS_1, ID_LISTAPRECIOS_2, ID_LISTAPRECIOS_3 → Tabla de listas de precios (no definida como FK)
- ID_GIRO_COMERCIAL → Tabla de giros comerciales (no definida como FK)
- ID_RUTAVEND → Tabla de rutas de venta (no definida como FK)
- ID_RUTAENTREGA → Tabla de rutas de entrega (no definida como FK)
- ID_PORCIVA → Tabla de impuestos/IVA (no definida como FK)
- ID_GRUPO_EMPRESARIAL → Tabla de grupos empresariales (no definida como FK)

---


## Tabla: PBIT_CLIENTES_DIR_2

**Descripción:**  
Tabla que almacena la información de direcciones, ubicación geográfica y datos de contacto de los clientes, incluyendo tanto la dirección fiscal como la dirección de entrega.

---

### Campos

| Campo                   | Tipo          | Null | Descripción |
|-------------------------|---------------|------|-------------|
| ID_CLIENTE              | INT           | No   | Identificador del cliente (relación con tabla de clientes). |
| ID_PAIS                 | INT           | Sí   | País de la dirección fiscal. |
| ID_ESTADO               | INT           | Sí   | Estado de la dirección fiscal. |
| ID_CIUDAD               | INT           | Sí   | Ciudad de la dirección fiscal. |
| ID_COLONIA              | INT           | Sí   | Colonia de la dirección fiscal. |
| CALLE                   | VARCHAR(MAX)  | Sí   | Nombre de la calle. |
| NUM_EXT                 | VARCHAR(50)   | Sí   | Número exterior. |
| NUM_INT                 | VARCHAR(50)   | Sí   | Número interior. |
| CALLE_LAT_IZQ           | VARCHAR(50)   | Sí   | Calle lateral izquierda. |
| CALLE_LAT_DER           | VARCHAR(50)   | Sí   | Calle lateral derecha. |
| UBICACION               | INT           | Sí   | Referencia de ubicación (posible clave geográfica interna). |
| ENTREGA_ID_PAIS         | INT           | Sí   | País de la dirección de entrega. |
| ENTREGA_ID_ESTADO       | INT           | Sí   | Estado de la dirección de entrega. |
| ENTREGA_ID_CIUDAD       | INT           | Sí   | Ciudad de la dirección de entrega. |
| ENTREGA_ID_COLONIA      | INT           | Sí   | Colonia de la dirección de entrega. |
| ENTREGA_CALLE           | VARCHAR(MAX)  | Sí   | Calle de la dirección de entrega. |
| ENTREGA_NUM_EXT         | VARCHAR(50)   | Sí   | Número exterior de entrega. |
| ENTREGA_NUM_INT         | VARCHAR(50)   | Sí   | Número interior de entrega. |
| ENTREGA_CALLE_LAT_IZQ   | VARCHAR(50)   | Sí   | Calle lateral izquierda de entrega. |
| ENTREGA_CALLE_LAT_DER   | VARCHAR(50)   | Sí   | Calle lateral derecha de entrega. |
| ENTREGA_UBICACION       | INT           | Sí   | Referencia de ubicación de entrega. |
| TEL_OFICINA             | VARCHAR(10)   | Sí   | Teléfono de oficina del cliente. |
| CELULAR_1               | VARCHAR(10)   | Sí   | Número de celular 1. |
| CELULAR_2               | VARCHAR(10)   | Sí   | Número de celular 2. |
| CELULAR_3               | VARCHAR(10)   | Sí   | Número de celular 3. |
| CELULAR_4               | VARCHAR(10)   | Sí   | Número de celular 4. |
| CELULAR_SMS_1           | VARCHAR(10)   | Sí   | Número celular para SMS 1. |
| CELULAR_SMS_2           | VARCHAR(10)   | Sí   | Número celular para SMS 2. |
| EMAIL_1                 | VARCHAR(50)   | Sí   | Correo electrónico principal. |
| EMAIL_2                 | VARCHAR(50)   | Sí   | Correo electrónico secundario. |

---

**Relaciones lógicas identificadas:**

- ID_CLIENTE → Tabla de clientes (relación principal, no definida como FK)
- ID_PAIS → Tabla de países (no definida como FK)
- ID_ESTADO → Tabla de estados (no definida como FK)
- ID_CIUDAD → Tabla de ciudades (no definida como FK)
- ID_COLONIA → Tabla de colonias (no definida como FK)

- ENTREGA_ID_PAIS → Tabla de países (dirección de entrega)
- ENTREGA_ID_ESTADO → Tabla de estados (entrega)
- ENTREGA_ID_CIUDAD → Tabla de ciudades (entrega)
- ENTREGA_ID_COLONIA → Tabla de colonias (entrega)

---


## Tabla: PBIT_CLIENTES_SAT_2

**Descripción:**  
Tabla que almacena la configuración fiscal del cliente conforme a los catálogos del SAT, incluyendo uso de CFDI, formas de pago, método de pago y régimen fiscal.

---

### Campos

| Campo              | Tipo | Null | Descripción |
|--------------------|------|------|-------------|
| ID_CLIENTE         | INT  | No   | Identificador del cliente (relación con tabla de clientes). |
| ID_USOCFDI         | INT  | Sí   | Uso de CFDI asignado al cliente. |
| ID_FORMAPAGO_MN    | INT  | Sí   | Forma de pago en moneda nacional. |
| ID_FORMAPAGO_US    | INT  | Sí   | Forma de pago en moneda extranjera (USD). |
| ID_METODOPAGO      | INT  | Sí   | Método de pago (ej. PUE, PPD). |
| ID_REGIMENFISCAL   | INT  | Sí   | Régimen fiscal del cliente. |

---

**Relaciones lógicas identificadas:**

- ID_CLIENTE → Tabla de clientes (no definida como FK)
- ID_USOCFDI → Catálogo SAT de uso de CFDI (no definida como FK)
- ID_FORMAPAGO_MN → Catálogo SAT de formas de pago (no definida como FK)
- ID_FORMAPAGO_US → Catálogo SAT de formas de pago (no definida como FK)
- ID_METODOPAGO → Catálogo SAT de métodos de pago (no definida como FK)
- ID_REGIMENFISCAL → Catálogo SAT de regímenes fiscales (no definida como FK)

---


## Tabla: PBIT_COLONIAS

**Descripción:**  
Tabla que almacena las colonias o localidades, incluyendo su código postal y su relación con la ciudad, así como una posible referencia a catálogos del SAT.

---

### Campos

| Campo            | Tipo         | Null | Descripción |
|------------------|--------------|------|-------------|
| ID_COLONIA       | INT          | No   | Identificador único de la colonia (PK). |
| NOM_COLONIA      | VARCHAR(MAX) | No   | Nombre de la colonia. |
| CODIGO_POSTAL    | INT          | Sí   | Código postal de la colonia. |
| ID_CIUDAD        | INT          | Sí   | Identificador de la ciudad a la que pertenece la colonia. |
| ID_COLONIA_SAT   | INT          | Sí   | Identificador de la colonia según catálogo del SAT. |

---

**Relaciones lógicas identificadas:**

- ID_CIUDAD → Tabla de ciudades (no definida como FK)
- ID_COLONIA_SAT → Catálogo SAT de colonias (no definida como FK)

---

## Tabla: PBIT_ESTADOS

**Descripción:**  
Tabla que almacena los estados o entidades federativas, permitiendo su asociación con un país dentro de la estructura geográfica del sistema.

---

### Campos

| Campo       | Tipo         | Null | Descripción |
|-------------|--------------|------|-------------|
| ID_ESTADO   | INT          | No   | Identificador único del estado (PK). |
| NOM_ESTADO  | VARCHAR(MAX) | No   | Nombre del estado o entidad federativa. |
| ID_PAIS     | INT          | Sí   | Identificador del país al que pertenece el estado. |

---

**Relaciones lógicas identificadas:**

- ID_PAIS → Tabla de países (no definida como FK)

---

## Tabla: PBIT_FACTURASCLIE_2

**Descripción:**  
Tabla que almacena la información de las facturas de clientes, incluyendo datos generales de la transacción, cliente, vendedor, montos e información fiscal al momento de la facturación.

---

### Campos

| Campo                    | Tipo            | Null | Descripción |
|--------------------------|-----------------|------|-------------|
| ID_FACTURA               | INT             | No   | Identificador único de la factura (PK). |
| FECHA                    | DATE            | No   | Fecha de emisión de la factura. |
| ID_CLIENTE               | INT             | No   | Identificador del cliente. |
| ID_VENDEDOR              | VARCHAR(50)     | Sí   | Identificador del vendedor. |
| ID_ALMACEN               | INT             | Sí   | Identificador del almacén. |
| CONDICIONES              | CHAR(20)        | No   | Condiciones de pago de la factura. |
| MONEDA                   | CHAR(3)         | No   | Moneda en la que se emite la factura. |
| TIPO_CAMBIO              | DECIMAL(10,4)   | Sí   | Tipo de cambio aplicado. |
| ID_PEDIDO                | INT             | No   | Identificador del pedido relacionado. |
| ID_SUCURSAL              | INT             | Sí   | Identificador de la sucursal. |
| NOM_SUCURSAL             | VARCHAR(MAX)    | Sí   | Nombre de la sucursal. |
| VENCIMIENTO              | DATE            | Sí   | Fecha de vencimiento de la factura. |
| ID_DEVOLUCION            | VARCHAR(50)     | Sí   | Identificador de devolución asociada. |
| IMP_SUBTOTAL             | DECIMAL(16,2)   | Sí   | Importe subtotal de la factura. |
| IMP_IVA                  | DECIMAL(16,2)   | Sí   | Importe de IVA. |
| IMP_TOTAL                | DECIMAL(16,2)   | Sí   | Importe total de la factura. |
| CLIENTE_RAZON            | VARCHAR(MAX)    | Sí   | Razón social del cliente al momento de la factura. |
| CLIENTE_RFC              | VARCHAR(MAX)    | Sí   | RFC del cliente. |
| CLIENTE_COLONIA          | VARCHAR(MAX)    | Sí   | Colonia del cliente. |
| CLIENTE_CALLE            | VARCHAR(MAX)    | Sí   | Calle del cliente. |
| CLIENTE_CP               | VARCHAR(MAX)    | Sí   | Código postal del cliente. |
| CLIENTE_NUMEXT           | VARCHAR(MAX)    | Sí   | Número exterior del cliente. |
| CLIENTE_NUMINT           | VARCHAR(MAX)    | Sí   | Número interior del cliente. |
| CLIENTE_CIUDAD           | VARCHAR(MAX)    | Sí   | Ciudad del cliente. |
| CLIENTE_ESTADO           | VARCHAR(MAX)    | Sí   | Estado del cliente. |
| CLIENTE_PAIS             | VARCHAR(MAX)    | Sí   | País del cliente. |
| PORC_IVA                 | INT             | Sí   | Porcentaje de IVA aplicado. |
| IMP_SUBTOTAL_MN          | DECIMAL(16,2)   | Sí   | Subtotal en moneda nacional. |
| IMP_IVA_MN               | DECIMAL(16,2)   | Sí   | IVA en moneda nacional. |
| IMP_TOTAL_MN             | DECIMAL(16,2)   | Sí   | Total en moneda nacional. |
| IMP_DEVOLUCION           | DECIMAL(16,2)   | Sí   | Importe de devoluciones. |
| IMP_DEVOLUCION_MN        | DECIMAL(16,2)   | Sí   | Devoluciones en moneda nacional. |
| IMP_NOTACREDITO          | DECIMAL(16,2)   | Sí   | Importe de notas de crédito. |
| IMP_NOTA_CREDITO_MN      | DECIMAL(16,2)   | Sí   | Notas de crédito en moneda nacional. |
| IMP_SUBTOTAL_NETO        | DECIMAL(16,2)   | Sí   | Subtotal neto. |
| IMP_SUBTOTAL_NETO_MN     | DECIMAL(16,2)   | Sí   | Subtotal neto en moneda nacional. |

---

**Relaciones lógicas identificadas:**

- ID_CLIENTE → Tabla de clientes (no definida como FK)
- ID_VENDEDOR → Tabla de vendedores (no definida como FK)
- ID_ALMACEN → Tabla de almacenes (no definida como FK)
- ID_PEDIDO → Tabla de pedidos (no definida como FK)
- ID_SUCURSAL → Tabla de sucursales (no definida como FK)
- ID_DEVOLUCION → Tabla de devoluciones (no definida como FK)

---

## Tabla: PBIT_FACTURASCLIE_ARTICULOS_2

**Descripción:**  
Tabla que almacena el detalle de los artículos incluidos en cada factura de cliente, incluyendo cantidades, precios, impuestos y datos fiscales del producto al momento de la transacción.

---

### Campos

| Campo                 | Tipo            | Null | Descripción |
|-----------------------|-----------------|------|-------------|
| ID_FACTURA            | INT             | No   | Identificador de la factura (relación con encabezado). |
| REN                   | INT             | No   | Número de renglón o partida dentro de la factura. |
| ID_PRODUCTO           | INT             | No   | Identificador del producto. |
| ID_UNIDAD             | VARCHAR(50)     | Sí   | Unidad de medida del producto. |
| PRECIO                | DECIMAL(16,2)   | Sí   | Precio unitario del producto. |
| CANTIDAD              | INT             | Sí   | Cantidad facturada. |
| PORC_IVA              | INT             | Sí   | Porcentaje de IVA aplicado. |
| CODIGO_PRODUCTO       | VARCHAR(MAX)    | Sí   | Código del producto al momento de la factura. |
| DESC_PRODUCTO         | VARCHAR(MAX)    | Sí   | Descripción del producto al momento de la factura. |
| PRODUCTOSAT_ID        | INT             | Sí   | Identificador del producto según catálogo SAT. |
| PRODUCTOSAT_CODIGO    | VARCHAR(MAX)    | Sí   | Código SAT del producto. |
| UNIDADSAT_ID          | INT             | Sí   | Identificador de la unidad según SAT. |
| UNIDADSAT_CODIGO      | VARCHAR(MAX)    | Sí   | Código SAT de la unidad. |
| BASE_IMPUESTO         | VARCHAR(MAX)    | Sí   | Base para el cálculo del impuesto. |
| IMPUESTO              | VARCHAR(MAX)    | Sí   | Tipo de impuesto aplicado. |
| TIPO_FACTOR           | VARCHAR(MAX)    | Sí   | Tipo de factor del impuesto (tasa, cuota, etc.). |
| TASAOCUOTA            | VARCHAR(MAX)    | Sí   | Tasa o cuota del impuesto. |
| IMP_IMPUESTO          | VARCHAR(MAX)    | Sí   | Importe del impuesto calculado. |
| CTO_MN                | DECIMAL(16,4)   | Sí   | Costo en moneda nacional. |
| CTO_US                | DECIMAL(16,4)   | Sí   | Costo en moneda extranjera. |
| CTO_AUDITORIA_MN      | DECIMAL(16,4)   | Sí   | Costo de auditoría en moneda nacional. |
| IMP                   | DECIMAL(16,2)   | Sí   | Importe total de la línea. |
| CANT_DEV              | INT             | Sí   | Cantidad devuelta. |
| IMP_DEV               | DECIMAL(16,2)   | Sí   | Importe de devolución. |
| CANT_NETO             | INT             | Sí   | Cantidad neta después de devoluciones. |
| IMP_NETO              | DECIMAL(16,2)   | Sí   | Importe neto después de devoluciones. |

---

**Relaciones lógicas identificadas:**

- ID_FACTURA → Tabla PBIT_FACTURASCLIE_2 (no definida como FK)
- ID_PRODUCTO → Tabla de productos (no definida como FK)
- ID_UNIDAD → Catálogo de unidades (no definida como FK)
- PRODUCTOSAT_ID → Catálogo SAT de productos (no definida como FK)
- UNIDADSAT_ID → Catálogo SAT de unidades (no definida como FK)

---

## Tabla: PBIT_FACTURASCLIE_ESTATUS_2

**Descripción:**  
Tabla que almacena el estatus de las facturas de clientes, especialmente información relacionada con cancelaciones tanto a nivel sistema como ante el SAT.

---

### Campos

| Campo                | Tipo       | Null | Descripción |
|----------------------|------------|------|-------------|
| ID_FACTURA           | INT        | No   | Identificador de la factura (relación con encabezado). |
| CANCELADA            | INT        | Sí   | Indica si la factura está cancelada en el sistema. |
| CANCELACION_USUARIO  | VARCHAR(50)| Sí   | Usuario que realizó la cancelación. |
| CANCELACION_FECHA    | DATE       | Sí   | Fecha en que se realizó la cancelación. |
| CANCELACION_HORA     | TIME(7)    | Sí   | Hora de la cancelación. |
| CANCELADA_SAT        | INT        | Sí   | Indica si la factura fue cancelada ante el SAT. |

---

**Relaciones lógicas identificadas:**

- ID_FACTURA → Tabla PBIT_FACTURASCLIE_2 (no definida como FK)

---



## Tabla: PBIT_FACTURASCLIE_PAGOS_2

**Descripción:**  
Tabla que almacena los pagos aplicados a las facturas de clientes, incluyendo referencias de cobranza, montos en diferentes monedas y fechas de pago.

---

### Campos

| Campo        | Tipo            | Null | Descripción |
|--------------|-----------------|------|-------------|
| ID_FACTURA   | INT             | No   | Identificador de la factura (relación con encabezado). |
| REF          | INT             | No   | Referencia o consecutivo del pago aplicado a la factura. |
| ID_COBRANZA  | VARCHAR(55)     | No   | Identificador del movimiento de cobranza. |
| IMP_MN       | DECIMAL(16,2)   | Sí   | Importe del pago en moneda nacional. |
| IMP_US       | DECIMAL(16,2)   | Sí   | Importe del pago en moneda extranjera. |
| TIPO_CAMBIO  | DECIMAL(10,4)   | Sí   | Tipo de cambio aplicado al pago. |
| FECHA_PAGO   | DATE            | Sí   | Fecha en que se realizó el pago. |

---

**Relaciones lógicas identificadas:**

- ID_FACTURA → Tabla PBIT_FACTURASCLIE_2 (no definida como FK)
- ID_COBRANZA → Tabla de cobranza/pagos (no definida como FK)

---


## Tabla: PBIT_FACTURASCLIE_SAT_2

**Descripción:**  
Tabla que almacena la información fiscal de las facturas de clientes conforme a los requisitos del SAT, incluyendo UUID, códigos de catálogos fiscales y datos necesarios para la facturación electrónica.

---

### Campos

| Campo                | Tipo         | Null | Descripción |
|----------------------|--------------|------|-------------|
| ID_FACTURA           | INT          | No   | Identificador de la factura (relación con encabezado). |
| FOLIO_UUID           | VARCHAR(50)  | Sí   | Folio fiscal único (UUID) asignado por el SAT. |
| COD_METODOPAGOSAT    | VARCHAR(3)   | Sí   | Código SAT del método de pago. |
| COD_FORMAPAGOSAT     | VARCHAR(3)   | Sí   | Código SAT de la forma de pago. |
| COD_USCOCFDISAT      | VARCHAR(3)   | Sí   | Código SAT del uso de CFDI. |
| COD_REGIMENSAT       | VARCHAR(3)   | Sí   | Código SAT del régimen fiscal. |
| CPSAT                | INT          | Sí   | Código postal fiscal según SAT. |

---

**Relaciones lógicas identificadas:**

- ID_FACTURA → Tabla PBIT_FACTURASCLIE_2 (no definida como FK)
- COD_METODOPAGOSAT → Catálogo SAT de métodos de pago (no definida como FK)
- COD_FORMAPAGOSAT → Catálogo SAT de formas de pago (no definida como FK)
- COD_USCOCFDISAT → Catálogo SAT de uso de CFDI (no definida como FK)
- COD_REGIMENSAT → Catálogo SAT de régimen fiscal (no definida como FK)

---

## Tabla: PBIT_LISTAPRECIOS

**Descripción:**  
Tabla que almacena las listas de precios disponibles en el sistema, incluyendo su descripción, zona asociada y configuraciones relacionadas con la aplicación de descuentos.

---

### Campos

| Campo                | Tipo         | Null | Descripción |
|----------------------|--------------|------|-------------|
| ID_LISTAPRECIOS      | INT          | No   | Identificador único de la lista de precios (PK). |
| DESCRIPCION          | VARCHAR(50)  | No   | Nombre o descripción de la lista de precios. |
| ID_ZONA              | INT          | Sí   | Identificador de la zona asociada a la lista de precios. |
| MENSAJE              | VARCHAR(MAX) | Sí   | Mensaje o nota asociada a la lista de precios. |
| COMENTARIOS          | VARCHAR(MAX) | Sí   | Comentarios adicionales sobre la lista de precios. |
| NO_APLICA_DESCUENTOS | INT          | Sí   | Indica si la lista de precios no permite descuentos. |

---

**Relaciones lógicas identificadas:**

- ID_ZONA → Tabla de zonas (no definida como FK)
- ID_LISTAPRECIOS → Referenciada en tabla de clientes (no definida como FK)

---

## Tabla: PBIT_MARCAS

**Descripción:**  
Tabla que almacena las marcas de los productos disponibles en el sistema, permitiendo su clasificación y agrupación comercial.

---

### Campos

| Campo       | Tipo         | Null | Descripción |
|-------------|--------------|------|-------------|
| ID_MARCA    | INT          | No   | Identificador único de la marca (PK). |
| NOM_MARCA   | VARCHAR(50)  | No   | Nombre de la marca. |
| COD_MARCA   | VARCHAR(5)   | Sí   | Código abreviado de la marca. |

---

**Relaciones lógicas identificadas:**

- ID_MARCA → Referenciada en tabla de productos (no definida como FK)

---

## Tabla: PBIT_PAISES

**Descripción:**  
Tabla que almacena los países disponibles en el sistema, utilizada para clasificación geográfica de clientes, estados y direcciones de entrega.

---

### Campos

| Campo      | Tipo         | Null | Descripción |
|------------|--------------|------|-------------|
| ID_PAIS    | INT          | No   | Identificador único del país (PK). |
| NOM_PAIS   | VARCHAR(MAX) | No   | Nombre del país. |

---

**Relaciones lógicas identificadas:**

- ID_PAIS → Referenciada en tabla de estados, clientes y direcciones (no definida como FK)

---

## Tabla: PBIT_PROVEEDORES

**Descripción:**  
Tabla que almacena información de los proveedores del sistema, incluyendo datos fiscales, comerciales y configuración de impuestos.

---

### Campos

| Campo                     | Tipo         | Null | Descripción |
|---------------------------|--------------|------|-------------|
| ID_PROVEEDOR              | INT          | No   | Identificador único del proveedor (PK). |
| RAZON_SOCIAL_PROV         | VARCHAR(50)  | No   | Razón social del proveedor. |
| RFC_PROV                  | VARCHAR(MAX) | Sí   | RFC del proveedor (fiscal). |
| COD_PROV                  | VARCHAR(5)   | Sí   | Código interno del proveedor. |
| ID_PORCIVA                | VARCHAR(MAX) | Sí   | Identificador del porcentaje de IVA aplicable. |
| NOMBRE_COMERCIAL_PROV     | VARCHAR(MAX) | Sí   | Nombre comercial del proveedor. |
| EXTRANJERO                | CHAR(2)      | Sí   | Indica si el proveedor es extranjero. |

---

**Relaciones lógicas identificadas:**

- ID_PROVEEDOR → Referenciada en tabla de productos/artículos (no definida como FK)
- ID_PORCIVA → Tabla de porcentajes de IVA (no definida como FK)

---

## Tabla: PBIT_RUTAS

**Descripción:**  
Tabla que almacena las rutas asignadas a los vendedores, utilizadas para organizar la entrega de productos o visitas a clientes.

---

### Campos

| Campo       | Tipo        | Null | Descripción |
|-------------|------------|------|-------------|
| ID_RUTA     | INT        | No   | Identificador único de la ruta (PK). |
| DESCRIPCION | VARCHAR(50)| No   | Nombre o descripción de la ruta. |
| ID_VENDEDOR | VARCHAR(MAX)| Sí  | Identificador del vendedor asignado a la ruta. |

---

**Relaciones lógicas identificadas:**

- ID_VENDEDOR → Tabla de vendedores (no definida como FK)
- ID_RUTA → Referenciada en tabla de clientes para asignación de ruta (no definida como FK)

---

## Tabla: PBIT_RUTASENTREGA_2

**Descripción:**  
Tabla que almacena las rutas de entrega de productos, utilizadas para organizar la logística de distribución hacia clientes o puntos de venta.

---

### Campos

| Campo          | Tipo        | Null | Descripción |
|----------------|-------------|------|-------------|
| ID_RUTAENTREGA | INT         | No   | Identificador único de la ruta de entrega (PK). |
| DESC_RUTA      | VARCHAR(50) | Sí   | Descripción o nombre de la ruta de entrega. |

---

**Relaciones lógicas identificadas:**

- ID_RUTAENTREGA → Referenciada en PBIT_CLIENTES como `ID_RUTAENTREGA` (no definida como FK)

---

## Tabla: PBIT_SUCURSALES_2

**Descripción:**  
Tabla que almacena información de sucursales o puntos de entrega de clientes, incluyendo dirección, ubicación geográfica y asignación de rutas de entrega.

---

### Campos

| Campo                | Tipo         | Null | Descripción |
|----------------------|--------------|------|-------------|
| ID_SUCURSAL          | INT          | No   | Identificador único de la sucursal (PK). |
| NOM_SUCURSAL         | VARCHAR(MAX) | No   | Nombre de la sucursal. |
| ID_CLIENTE           | INT          | No   | Identificador del cliente al que pertenece la sucursal. |
| ID_VENDEDOR          | VARCHAR(10)  | No   | Identificador del vendedor asignado a la sucursal. |
| CLAVE_SUC_CLIENTE    | VARCHAR(10)  | Sí   | Clave interna de la sucursal en el sistema del cliente. |
| ID_PAIS              | INT          | Sí   | Identificador del país de la sucursal. |
| ID_ESTADO            | INT          | Sí   | Identificador del estado de la sucursal. |
| ID_CIUDAD            | INT          | Sí   | Identificador de la ciudad de la sucursal. |
| ID_COLONIA           | INT          | Sí   | Identificador de la colonia de la sucursal. |
| CALLE                | VARCHAR(MAX) | Sí   | Calle de la sucursal. |
| NUM_EXT              | VARCHAR(50)  | Sí   | Número exterior. |
| NUM_INT              | VARCHAR(50)  | Sí   | Número interior. |
| GPS_LAT              | VARCHAR(50)  | Sí   | Latitud geográfica de la sucursal. |
| GPS_LON              | VARCHAR(50)  | Sí   | Longitud geográfica de la sucursal. |
| IMPRIMIR_DIR_SUC     | INT          | Sí   | Indica si la dirección debe imprimirse en documentos. |
| RUTA_ENTREGA_ID      | INT          | Sí   | Identificador de la ruta de entrega asignada. |

---

**Relaciones lógicas identificadas:**

- ID_CLIENTE → PBIT_CLIENTES (no definida como FK)  
- ID_PAIS → PBIT_PAISES (no definida como FK)  
- ID_ESTADO → PBIT_ESTADOS (no definida como FK)  
- ID_CIUDAD → PBIT_CIUDADES (no definida como FK)  
- ID_COLONIA → PBIT_COLONIAS (no definida como FK)  
- RUTA_ENTREGA_ID → PBIT_RUTASENTREGA_2 (no definida como FK)

---

## Tabla: PBIT_TIPOVEND

**Descripción:**  
Tabla que almacena los diferentes tipos de vendedores o perfiles comerciales dentro del sistema.

---

### Campos

| Campo        | Tipo        | Null | Descripción |
|--------------|-------------|------|-------------|
| ID_TIPOVEND  | CHAR(1)     | No   | Identificador único del tipo de vendedor (PK). |
| DESCRIPCION  | VARCHAR(50) | No   | Descripción o nombre del tipo de vendedor. |

---

**Relaciones lógicas identificadas:**

- ID_TIPOVEND → Puede relacionarse con la tabla de vendedores (no definida como FK)

---

## Tabla: PBIT_VENDEDORES

**Descripción:**  
Tabla que almacena información de los vendedores, incluyendo datos de contacto, tipo, comisiones y estado dentro del sistema.

---

### Campos

| Campo           | Tipo          | Null | Descripción |
|-----------------|---------------|------|-------------|
| ID_VENDEDOR     | VARCHAR(5)    | No   | Identificador único del vendedor (PK). |
| NOM_VENDEDOR    | VARCHAR(MAX)  | No   | Nombre completo del vendedor. |
| PORC_COMISION   | DECIMAL(10,4) | Sí   | Porcentaje de comisión asignado al vendedor. |
| TIPO            | CHAR(1)       | Sí   | Tipo de vendedor (relacionado con PBIT_TIPOVEND). |
| TELEFONO_1      | VARCHAR(10)   | Sí   | Teléfono principal de contacto. |
| TELEFONO_2      | VARCHAR(10)   | Sí   | Teléfono secundario. |
| CELULAR_1       | VARCHAR(10)   | Sí   | Número de celular. |
| EMAIL           | VARCHAR(50)   | Sí   | Correo electrónico del vendedor. |
| PRESUPUESTO     | DECIMAL(10,2) | Sí   | Presupuesto asignado al vendedor. |
| INACTIVO        | INT           | Sí   | Indicador si el vendedor está inactivo. |
| EXTERNO         | INT           | Sí   | Indicador si el vendedor es externo. |
| COMISIONISTA    | INT           | Sí   | Indicador si el vendedor recibe comisión. |

---

**Relaciones lógicas identificadas:**

- TIPO → PBIT_TIPOVEND (tipo de vendedor)  
- ID_VENDEDOR → Referenciado en clientes, rutas y sucursales (no definidas como FK)

---

## Tabla: PBIT_ZONAS

**Descripción:**  
Tabla que almacena las zonas comerciales del sistema, utilizadas para asignar clientes, listas de precios y segmentación de ventas.

---

### Campos

| Campo         | Tipo        | Null | Descripción |
|---------------|-------------|------|-------------|
| ID_ZONA       | INT         | No   | Identificador único de la zona (PK). |
| DESCRIPCION   | VARCHAR(50) | No   | Nombre o descripción de la zona. |
| RANGO_PRECIOS | VARCHAR(50) | Sí   | Rango de precios aplicable para la zona. |

---

**Relaciones lógicas identificadas:**

- ID_ZONA → Referenciada en clientes y listas de precios (no definida como FK)

---


## Tabla: PBIT_GIROs_COMERCIALES

**Descripción:**  
Tabla que almacena la información de los giros comerciales registrados en el sistema, permitiendo clasificar entidades según su actividad económica o sector comercial.

---

### Campos

| Campo                | Tipo         | Null | Descripción |
|----------------------|--------------|------|-------------|
| ID_GIRO_COMERCIAL    | INT          | No   | Identificador único del giro comercial (PK). |
| DESC_GIRO_COMERCIAL  | VARCHAR(50)  | No   | Descripción o nombre del giro comercial. |

---

**Relaciones lógicas identificadas:**

- Puede ser utilizada como referencia en tablas de clientes, proveedores o empresas.
- No se observa definición explícita de clave foránea en la estructura proporcionada.

---