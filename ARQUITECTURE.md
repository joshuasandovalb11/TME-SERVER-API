# **SISTEMA DE RASTREO EN TIEMPO REAL / HISTORIAL DE RUTAS (DISPOSITIVO MOVIL)**

#### 

### **1. BASE DE DATOS (SQL SERVER)**

* Dispositivos (El Eslabón Perdido): Catálogo que enlaza el UUID único del hardware del celular con el id\_vendedor. Permite que un empleado cambie de teléfono (iniciando sesión de nuevo) sin perder su historial, desactivando el UUID viejo y activando el nuevo.
* Estado\_dispositivos (Semáforo en Vivo): Tabla enana (un renglón por dispositivo) que NO acumula historial. Se actualiza constantemente mediante un UPDATE en lote cada 15-30 segundos desde Node.js para alimentar el mapa en tiempo real.
* Rutas\_moviles\_diarias (Historial Comprimido): Almacena el JSON de la ruta del día completo. Para no inflar la base de datos, el JSON se guarda en formato "Matriz" (Arreglo de arreglos sin llaves repetidas) y Node.js se encarga de transformarlo al vuelo.



Seguridad en Tabla Existente: Se inyectan las columnas pin\_activacion\_movil (VARCHAR 6) y expiracion\_pin directamente en la tabla actual de vendedores. Esto evita crear un sistema de usuarios paralelo y mantiene todo centralizado en SistemaRutasDB.



Protección contra Duplicados (Edge Case): La tabla rutas\_moviles\_diarias incluye una restricción UNIQUE (id\_vendedor, fecha). Si un empleado rompe su celular a mediodía y activa uno nuevo a la 1:00 PM, el servidor no creará dos rutas distintas, sino que anexará los datos del segundo celular al mismo registro del día.





### **2. API SERVIDOR (PM2 - NODE.JS/EXPRESS)**

##### **Rendimiento a nivel Arquitectonico**

Es una preocupación brillante y, de hecho, es el temor número uno de cualquier arquitecto de software cuando da el salto de las APIs tradicionales (REST) al mundo del tiempo real.

La respuesta corta es: No, WebSockets no va a saturar tu servidor ni afectará a los otros sistemas. De hecho, implementarlo correctamente consumirá menos recursos de tu servidor que si intentaras hacerlo con peticiones HTTP normales.

Para que tengas la total tranquilidad de que el rendimiento del servidor central se mantendrá impecable al manejar los 40 dispositivos móviles de la empresa en simultáneo, vamos a destripar cómo funciona Node.js bajo el capó y por qué es el rey indiscutible en este escenario.



###### ***1. El Mito del Peso: HTTP vs WebSockets***

Si el dashboard de React intentara saber la ubicación en tiempo real usando peticiones tradicionales (HTTP REST), tendría que preguntarle al servidor cada 2 segundos: "¿Hay datos nuevos?". Multiplica eso por los 40 dispositivos haciendo lo mismo. Eso se llama Short Polling. Cada petición HTTP abre una conexión, envía cabeceras de red pesadas, verifica autenticación, cierra la conexión y consume CPU. Eso sí mataría tu servidor.



La Magia del WebSocket:

Un WebSocket hace un solo "Apretón de Manos" (Handshake) al principio. A partir de ahí, la conexión se queda abierta como un tubo hueco y persistente. Cuando el celular se mueve, solo empuja un texto minúsculo de unos cuantos bytes ({id:"BHE", lat:32.5, lng:-117.0}) por ese tubo. Node.js no tiene que volver a autenticar ni procesar cabeceras pesadas. El impacto en la red y en la memoria RAM es cercano a cero.



###### ***2. La Verdadera Escala de Node.js***

Node.js no funciona como los servidores antiguos (como Apache o PHP) que crean un "hilo" (thread) pesado en el procesador por cada usuario conectado. Node.js utiliza una arquitectura llamada Event Loop (Bucle de Eventos), que es de un solo hilo pero completamente asíncrona.



Para Node.js, mantener 40, 400 o incluso 4,000 conexiones WebSockets abiertas al mismo tiempo no es nada. Son simples referencias en memoria.



Si los 40 celulares mandan un ping cada 5 segundos, tu servidor está recibiendo apenas 8 mensajes por segundo. Node.js puede procesar decenas de miles de mensajes por segundo sin sudar. Tus sistemas actuales (el visualizador de vehículos, el manejo de contactos, etc.) ni siquiera notarán que el WebSocket está ahí.



###### ***3. El Verdadero Cuello de Botella: Proteger SQL Server***

Aquí está el secreto industrial: El servidor Node.js es invencible, pero la base de datos no lo es. Si recibes 8 coordenadas por segundo y le lanzas 8 comandos UPDATE por segundo a SQL Server, el disco duro de la base de datos se va a estresar innecesariamente. Para garantizar fluidez extrema sin tocar el rendimiento, implementaremos un patrón de Desacoplamiento en Memoria:



* Recepción Inmediata: El celular manda la coordenada. Node.js la recibe por el WebSocket.
* Retransmisión a la Vista (Fluidez 100%): Node.js rebota esa coordenada instantáneamente por el tubo WebSocket del dashboard web. El mapa de React actualiza el pin del vendedor en milisegundos. ¡Cero latencia!
* Buffer de Base de Datos (Protección SQL): Node.js NO guarda el dato en SQL Server en ese instante. Lo guarda en una variable temporal en su propia memoria RAM (o en Redis).
* Actualización Controlada: Programamos un cron interno que, cada 15 o 30 segundos, toma las últimas posiciones de los 40 equipos desde la memoria y hace un único UPDATE masivo a la tabla estado\_dispositivos en SQL Server.



###### ***El Resultado Final***

Con esta arquitectura:

* El mapa en el dashboard se ve completamente fluido y en tiempo real, porque se alimenta del túnel directo de WebSockets.
* SQL Server está relajado, recibiendo actualizaciones perezosas cada 15 segundos, lo que no interfiere con las consultas pesadas de los otros módulos.
* Node.js maneja la orquestación como un director de orquesta, usando una fracción minúscula de su CPU.



##### **El Endpoint de Activación (One-Time Provisioning)**

Se creará un endpoint exclusivo (POST /api/dispositivos/activar) que actuará como la única puerta de entrada para registrar un nuevo celular.



* El Handshake Seguro: Recibe el ID del vendedor, el PIN de 6 dígitos y el UUID oculto del teléfono.
* Validación y "Quema": El servidor valida que el PIN coincida y no esté expirado. Si es exitoso, registra el UUID en cat\_dispositivos y automáticamente "quema" (vuelve NULL) el PIN en la base de datos para que no pueda ser reutilizado en otro teléfono personal.





### **3. APLICACION MOVIL (REACT NATIVE)**

##### **Login en la App**

Es la decisión más escalable y automatizada. No tendrás que registrar nada manualmente.



###### ***🔄 ¿Cómo funciona el Login y el Cambio de Dispositivo?***

El login se hace una sola vez en la vida (o hasta que el usuario cierre sesión). Así es la mecánica exacta para resolver el problema de los cambios de equipo:



1. El Primer Ingreso: El empleado descarga la app. La aplicación, por debajo del agua, le pide al sistema operativo un identificador único del hardware (ej. UUID: 8f7e6d5c...). El empleado ingresa su ID (BHE) y su PIN.
2. El "Apretón de Manos" (Handshake): La app envía al servidor: "Soy el dispositivo 8f7e6... y me acabo de autenticar exitosamente como el empleado BHE".
3. El Registro Automático: Node.js guarda esa relación en la base de datos. A partir de ese segundo, el celular jamás vuelve a pedir contraseña. Durante todo el día, solo manda un ping: { "d": "8f7e6d5c...", "lt": 32.5, "ln": -117.0 }. Node.js busca en la tabla y dice: "Ah, este UUID le pertenece a BHE".
4. El Escenario del Celular Nuevo: Si el empleado pierde su teléfono y le dan uno nuevo, simplemente descarga la app en el nuevo equipo y hace login. La app generará un nuevo UUID (ej. UUID: 1a2b3c...). Node.js recibe el nuevo login, busca al empleado BHE y desactiva el UUID viejo, enlazando el nuevo. El historial se mantiene intacto porque está amarrado al id\_vendedor, no al dispositivo.





##### **Problematicas a considerar**

###### ***1. El Reto de la Conectividad: Zonas sin Señal y el Corte de Medianoche***

El principio de oro aquí es la arquitectura Store-and-Forward (Almacenar y Reenviar).



* Vía Tiempo Real (Desechable): Si el vendedor entra a un túnel y no hay red, la app intenta mandar el "ping" de tiempo real, falla, y lo descarta. No importa, porque el tiempo real es solo para el instante presente.



* Vía Histórica (Sagrada): La app jamás intenta mandar el punto histórico directo al servidor. Todo punto válido (cuando va en vehículo) se escribe inmediatamente en la base de datos local del teléfono (SQLite).



¿Qué pasa a las 11:59 PM si no hay Internet?

Absolutamente nada grave. La aplicación tiene programada una tarea de fondo (Background Fetch). A las 11:59 PM intenta armar el JSON. Si detecta que no hay Wi-Fi o datos, aborta la misión de envío, pero los datos se quedan intactos y seguros en SQLite.

El sistema operativo intentará de nuevo cada cierto tiempo (ej. cada hora) o disparará un evento en el instante exacto en que el teléfono recupere la conexión. Cuando la recupere (incluso si es a las 9:00 AM del día siguiente), enviará el JSON de ayer, Node.js responderá "Recibido con éxito", y solo entonces el celular borrará esos datos de SQLite.



###### ***2. El Reto del Dispositivo: Teléfono Apagado o App Cerrada***

Android e iOS son muy agresivos cerrando aplicaciones para ahorrar batería, pero tienen "puertas traseras" oficiales para aplicaciones de rastreo.



* Si el usuario "mata" la app (Swipe Up): El módulo de rastreo nativo levanta un "Servicio en Primer Plano" (Foreground Service) en Android (la clásica notificación permanente que dice "Compartiendo ubicación"). Esto vuelve a la app inmune; aunque la cierren de la pantalla, el motor en C++/Java sigue corriendo en el fondo.



* Si el teléfono se reinicia o se apaga por falta de batería: Configuramos un BootReceiver. En el milisegundo en que el teléfono se vuelve a encender, el sistema operativo arranca silenciosamente nuestro motor de rastreo en el fondo, sin que el vendedor tenga que abrir la aplicación.



###### ***3. El Reto de la Batería: La Máquina de Estados Inteligente***

Aquí es donde entra la "magia" tipo Life360. El hardware del GPS consume muchísima energía, por lo que el GPS debe estar apagado el mayor tiempo posible.



El teléfono se manejará mediante una Máquina de Estados dictada por el Acelerómetro (que casi no gasta batería):



* Estado: Estacionario (Durmiendo/Oficina): El acelerómetro detecta que el teléfono no se ha movido. El sistema crea una "Geocerca" (Geofence) invisible de 200 metros alrededor del teléfono y apaga la antena GPS por completo. La app puede mandar un latido de red (ping) cada hora solo para decir "Sigo aquí", lo cual gasta cero batería porque usa la red celular, no el GPS.



* Estado: En Movimiento (Vehículo): El vendedor se sube al auto. La vibración y velocidad del motor activan el acelerómetro. El SO rompe la geocerca, despierta la antena GPS de golpe, y empieza a grabar la ruta.



###### ***4. El Estándar de Volumen: ¿Cuántos datos almacena el JSON?***

Para que no te preocupes por la saturación de memoria en los celulares ni en tu base de datos SQL Server, hagamos matemáticas reales del estándar de la industria logística:



La regla no es grabar por tiempo (cada 1 segundo), sino por distancia. Configura la app para grabar 1 punto cada 50 metros.



Si un vendedor maneja 6 horas netas en un día a una velocidad promedio de 60 km/h, recorrerá 360 kilómetros.



A 1 punto cada 50 metros, el celular grabará 7,200 coordenadas en todo el día.



Utilizando nuestro formato "Matriz" \[lat, lng, ts, spd, sts], un JSON con 7,200 arreglos pesa aproximadamente 250 Kilobytes.



¡250 KB es la décima parte de lo que pesa una sola fotografía de WhatsApp! Tu servidor puede recibir eso en medio segundo, y el teléfono podría guardar 10 años de rutas en SQLite sin llenarse.





##### **Algoritmos de Telemetría Inteligente (El Modelo Telcel)**

Si Telcel logra mapear el día completo de un vehículo con apenas \~700 coordenadas, no es porque su GPS sea menos preciso, sino porque los rastreadores de hardware utilizan algoritmos de compresión geométrica directamente en su firmware antes de emitir el dato. Bajar de 7,200 a 700 puntos es una optimización brutal del 90% que te ahorrará ancho de banda, almacenamiento en SQL Server y procesamiento.



Ya logramos descargar la RAM del navegador delegando el procesamiento pesado de estos mismos Excels de Telcel a nuestro puente en Node.js para visualizarlos en el mapa. Ahora, el objetivo es inyectar esa misma "inteligencia de compresión" directamente en la aplicación móvil antes de que el JSON siquiera se genere.



Aquí tienes el secreto de la industria para lograr esa inteligencia de negocio y reducir drásticamente el volumen de datos en el dispositivo móvil:



Los rastreadores no guardan coordenadas guiándose únicamente por distancia o tiempo. Utilizan un modelo de tres reglas conocido como Filtro de Rumbo y Tolerancia (Heading \& Distance Tolerances).



###### ***1. El Filtro de Cambio de Rumbo (Heading Filter)***

Este es el mayor responsable del ahorro. Si un vendedor toma la carretera de cuota Tijuana-Mexicali (La Rumorosa) y maneja en línea recta por 10 kilómetros, guardar 200 puntos en esa recta es basura de datos.



La regla inteligente: El celular evalúa el ángulo de dirección. Solo guarda una nueva coordenada si el "rumbo" del vehículo cambia en más de 15 o 20 grados respecto al punto anterior.



El resultado: En rectas largas de carretera, el teléfono guarda solo el punto de inicio y el punto final. Pero si el vendedor entra a una colonia y da una vuelta en "U" o gira en una esquina, el cambio de ángulo dispara la coordenada inmediatamente para dibujar la curva perfecta.



###### ***2. El Filtro de Aceleración/Desaceleración Constante***

El GPS del celular también ignora las coordenadas si la velocidad se mantiene estable. Solo dispara un registro si detecta un frenón brusco o una aceleración fuerte (un cambio mayor a 15 km/h entre un segundo y otro). Esto no solo ahorra puntos, sino que te da inteligencia de negocio para saber si el chofer maneja de forma agresiva.



###### ***3. La Agrupación Estacionaria (Dwell Clustering)***

Cuando el Excel de Telcel marca que el vehículo estuvo detenido en un cliente por 45 minutos, no guarda 45 coordenadas repetidas.

La app móvil hará lo mismo: al detectar que la velocidad es 0 y no hay cambio de ubicación en un radio de 10 metros, guarda un evento STOP\_START. Cuando el celular vuelve a salir de ese radio de 10 metros, guarda un STOP\_END. Todo el tiempo intermedio se resume en 2 míseros renglones en la base de datos local (SQLite).



🛠️ ¿Cómo lo implementamos en React Native?

La excelente noticia es que no tienes que programar cálculos matemáticos de trigonometría compleja. Las librerías profesionales de React Native para flotas (como las que usan algoritmos de rastreo espacial) traen estos parámetros nativos listos para configurarse en el inicio de la app.



Tu configuración en el dispositivo móvil se vería más o menos así:

* distanceFilter: 0 (Desactivamos el guardado ciego por distancia).
* headingFilter: 15 (Solo guarda si gira el volante más de 15 grados).
* stopTimeout: 5 (Si pasan 5 minutos sin movimiento, consolida la parada y apaga el GPS).



Con esto, el JSON que envíes a la medianoche será una calca exacta de la eficiencia del Excel de Telcel que me mostraste, garantizando que tu tabla Rutas\_Moviles\_Diarias en SQL Server se mantenga delgada y rápida.



##### **DRY (Don't Repeat Yourself)**

Tu lógica de reutilizar el código existente es exactamente lo que dicta el principio DRY (Don't Repeat Yourself) en la ingeniería de software.

Tienes toda la razón en que el frontend no debe saber de dónde viene la información, y que tu backend ya tiene un motor excelente (el que construimos para procesar los Excels) que calcula paradas, tiempos y polilíneas hacia el contrato ProcessedTripV1.

Sin embargo, como Tech Lead, tengo que hacer un pequeño y crucial ajuste arquitectónico a tu propuesta para no dispararnos en el pie con el consumo de datos móviles:



###### ***⚠️ El Peligro de Imitar a Excel en el Teléfono***

Si obligamos a la aplicación móvil a generar un JSON pesado (con todas las llaves y formatos idénticos a los que escupe Telcel) antes de enviarlo por la red, perderemos toda la optimización de ancho de banda que logramos diseñando el formato "Matriz".



###### ***💡 La Solución: El "Falso Excel" en Node.js***

Aquí es donde aplicamos la magia de Node.js en su máxima expresión. El celular y la red seguirán trabajando en modo ultra-ligero, pero engañaremos a tu procesador actual para que crea que está leyendo un Excel:



* La App Móvil (Súper ligera): A las 11:59 PM manda la matriz comprimida que pesa solo unos kilobytes: \[\[32.5, -117.0, 1685, 45]].



* El Interceptor en Node.js (El Adaptador): Node.js recibe esa matriz. Antes de mandarla a tu base de datos o procesarla, ejecuta un pequeño script que "infla" estos arreglos y les pone las llaves exactas que tenía el Excel original (Latitud, Longitud, Velocidad, Fecha).



* El Reúso de Lógica: Node.js toma este "Falso Excel" que acaba de crear en memoria y se lo inyecta a tu función actual (la que ya sabe calcular los tiempos muertos y las distancias).



* El Frontend (Ciego y Feliz): Recibe el ProcessedTripV1 final y pinta la línea azul sin cambiar una sola línea de código en React.



¡De esta manera obtenemos una victoria absoluta! Cuidamos los megas del plan de datos del celular y reusamos el 100% de la lógica pesada que ya programaste en el servidor.



###### ***🛑 Sobre el Tiempo de las Paradas (Stop Timeout)***

Tu deducción sobre los tiempos es perfecta. Configurar el stopTimeout de la aplicación móvil en 1 minuto es la estrategia correcta.



Al hacer esto, la base de datos local del celular será muy granular y registrará cualquier detención breve (un semáforo largo, tráfico, bajarse a comprar agua). Al llegar esta información granular al servidor, tu componente actual <GlobalFilters> en React se encargará de hacer la magia, permitiendo que el usuario filtre con la barra deslizable si quiere ver paradas > 1 min, > 15 min o > 30 min, exactamente igual que como funciona hoy con los camiones.



##### **Contrato de datos**

Entonces el JSON que mandara el dispositivo movil al servidor sera tipo asi?



{

"deviceId": "",

"date": "2026-06-02",

"columns": \["lat", "lng", "timestamp", "speed", "state"],

"events": \[

\[32.5149, -117.0382, 1685732400, 45, 1],

\[32.5150, -117.0380, 1685732460, 50, 1]

]

}



¡Totalmente correcto! Ese es exactamente el contrato final. Es una belleza de optimización que reduce el "peso" de la red al mínimo absoluto, manteniendo la legibilidad estructural gracias al arreglo de columns.

Y para responder a tus preguntas sobre las garantías del sistema, la respuesta es un rotundo SÍ a todo. Al implementar este diseño, estás aplicando directamente los patrones de grado empresarial más altos (Store-and-Forward y Edge Computing).

Aquí tienes el resumen exacto de cómo estas reglas garantizan el éxito de la operación:



###### ***1. La Reducción Masiva de Eventos (Edge Computing)***

Al configurar la aplicación móvil con los filtros inteligentes (Cambio de Rumbo > 15 grados y tolerancia de paradas de 1 minuto), el celular tomará las decisiones en el "borde" (Edge). No grabará basura. Es altamente probable que logres bajar de esos 700 eventos diarios por vendedor, especialmente si gran parte de su día se va en reuniones presenciales con clientes o manejando en vías rectas largas (como los libramientos o carreteras principales).

###### 

###### ***2. El Ciclo de Vida de los Datos (Almacenar, Enviar y Purgar)***

La robustez del sistema se basa en que el celular no confía ciegamente en la red. El ciclo de vida de un dato desde que nace hasta que muere será estrictamente este:



* Paso 1: Acumulación Segura. Durante todo el día, los eventos se guardan en el búnker de la app (SQLite). Si el vendedor se queda sin batería o sin datos, SQLite protege la información.
* Paso 2: El Corte Nocturno. A las 11:59 PM (o en la madrugada del día siguiente), la app empaca todo SQLite en ese JSON ligero y lo envía a Node.js mediante una petición HTTP POST.
* Paso 3: La Confirmación (Handshake). Node.js recibe el paquete, lo inserta en SQL Server y le responde al celular con un código de éxito estandarizado (200 OK).
* Paso 4: La Purga Definitiva. Solo y exclusivamente cuando el celular recibe ese 200 OK, ejecuta un comando DELETE en su base de datos local.



Con este ciclo, garantizas dos cosas fundamentales: cero pérdida de datos (si el servidor de Vercel o Node.js falla al momento del envío, el celular no borra nada y vuelve a intentar horas después) y cero acumulación de basura (el celular de los vendedores jamás se quedará sin espacio de almacenamiento, porque se limpia solo todos los días).





##### **Estrategia "Caballo de Troya" (Buscar Clientes)**

El módulo de rastreo en segundo plano se inyectará como una actualización obligatoria a la aplicación existente de Buscar Clientes.



* Fricción Cero: Los empleados no tienen que instalar una app nueva "para ser vigilados". Al ser una app de mapas, justifica nativamente el permiso de ubicación "Permitir todo el tiempo".





##### **La Bóveda Local (Token Persistente)**

La aplicación tendrá una pantalla de Activación Inicial que se mostrará una sola vez en la vida útil de la instalación.



* El usuario ingresa su ID y el PIN de 6 dígitos proporcionado por el administrador.
* Al validarse, la app guarda esta autorización en una bóveda cifrada local (AsyncStorage).
* En los días posteriores, al abrir la app, esta lee la bóveda y salta directamente al mapa. El usuario jamás vuelve a ver la pantalla de login.



##### **Casos de pérdida de Bóveda (Re-Activación)**

El sistema exigirá un nuevo PIN de 6 dígitos única y exclusivamente cuando la bóveda se destruya por reglas del sistema operativo:



1. Cambio de equipo físico (robo, pérdida o renovación).
2. Desinstalación manual de la app y posterior re-instalación.
3. Borrado forzado de caché/datos desde la configuración de Android/iOS.





### **4. DASHBOARD/VISUALIZADOR DE RUTAS (REACT TYPESCRIPT)**

* Segmented Control (Visualizador y Múltiple): Se integrará un interruptor en el Sidebar superior \[ 🚛 Flota GPS ] | \[ 📱 Personal Móvil ]. Al alternarlo, cambia la fuente de datos, pero el mapa de React dibuja las rutas usando el mismo componente y el mismo contrato ProcessedTripV1 gracias al "Falso Excel" de Node.js.
* Smart Fallback (Patrón de Conducta): La vista de analíticas NO tendrá interruptor. El backend aplicará la inteligencia de negocio: buscará primero si el vendedor tenía un vehículo asignado ese día. Si es así, usa el GPS del camión. Si no, hace un fallback automático y extrae la ruta del dispositivo móvil, unificando la experiencia del usuario.


##### **Panel de Administración MDM (Mobile Device Management)**

Vista de control de acceso restringido (disponible únicamente para rol de Administrador desde el menú de usuario). Actúa como el centro de mando de la flotilla móvil.



* DataGrid de Control: Tabla que muestra a todo el personal, su estado de conexión (Activo, Pendiente, Inactivo), el modelo exacto de su dispositivo (ej. Motorola Moto G) y la última fecha de actividad.
* Acción - Generar Código: Botón que solicita a Node.js la creación de un PIN efímero de 6 dígitos (válido por 24 horas) para que un empleado instale la app.
* Acción - Revocar Acceso: Botón de emergencia para casos de robo o despido. Cambia el estatus del dispositivo a 0, haciendo que el servidor rechace instantáneamente cualquier coordenada proveniente de ese UUID.





