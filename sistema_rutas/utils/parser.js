// sistema_marketing/utils/parser.js
const xlsx = require('xlsx');

const cleanText = (str) => String(str || '').trim().toLowerCase();

const formatearHoraSQL = (horaExcel) => {
    if (!horaExcel) return '00:00:00';
    
    let texto = String(horaExcel).trim().toUpperCase();
    
    if (!isNaN(texto) && texto.includes('.')) {
        const dateObj = xlsx.SSF.parse_date_code(parseFloat(texto));
        if (dateObj) {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${pad(dateObj.H)}:${pad(dateObj.M)}:${pad(dateObj.S)}`;
        }
    }

    let esPM = texto.includes('PM');
    let esAM = texto.includes('AM');
    
    let match = texto.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    
    if (match) {
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        let s = match[3] ? parseInt(match[3], 10) : 0;

        if (esPM && h < 12) h += 12;
        if (esAM && h === 12) h = 0;

        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    return '00:00:00';
};

/**
 * Función principal que procesa el archivo del GPS nativo (Excel .xlsx)
 */
const procesarArchivoRuta = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const filas = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

            let placaVehiculo = '';
            let fechaRuta = '';
            const dateRegex = /\d{4}-\d{2}-\d{2}/;

            // =========================================
            // 1. EXTRACCIÓN DE METADATOS
            // =========================================
            const filasBusquedaMeta = filas.slice(0, 20); 

            for (const fila of filasBusquedaMeta) {
                if (!Array.isArray(fila)) continue;

                for (let i = 0; i < fila.length; i++) {
                    const currentCellText = cleanText(fila[i]);
                    if (!currentCellText) continue;

                    const findNextValue = () => {
                        for (let j = i + 1; j < fila.length; j++) {
                            const nextValue = String(fila[j] || '').trim();
                            if (nextValue) return nextValue;
                        }
                        return null;
                    };

                    let value = null;

                    if (currentCellText.includes('vehículo placa') || currentCellText === 'placa') {
                        if (currentCellText.includes(':') && String(fila[i]).split(':')[1].trim() !== '') {
                            placaVehiculo = String(fila[i]).split(':')[1].trim().toUpperCase();
                        } else {
                            value = findNextValue();
                            if (value) placaVehiculo = value.toUpperCase();
                        }
                    } 
                    else if (currentCellText.includes('período') || currentCellText.includes('periodo')) {
                        const sameCellMatch = currentCellText.match(dateRegex);
                        if (sameCellMatch) {
                            fechaRuta = sameCellMatch[0];
                        } else {
                            value = findNextValue();
                            if (value) {
                                const nextCellMatch = value.match(dateRegex);
                                if (nextCellMatch) {
                                    fechaRuta = nextCellMatch[0];
                                } else {
                                    fechaRuta = value.split('..')[0].trim().split(' ')[0];
                                }
                            }
                        }
                    }
                }
            }

            if (!fechaRuta || !dateRegex.test(fechaRuta)) {
                for (const fila of filas) {
                    if (Array.isArray(fila) && fila.length > 0) {
                        const firstCol = String(fila[0] || '');
                        const match = firstCol.match(dateRegex);
                        if (match) {
                            fechaRuta = match[0];
                            break;
                        }
                    }
                }
            }

            if (!placaVehiculo || placaVehiculo === 'NO ENCONTRADA') {
                return reject(new Error("El sistema no pudo leer la placa del vehículo. Verifica que la celda diga 'Vehículo Placa'."));
            }
            if (!fechaRuta) {
                return reject(new Error("No se pudo extraer la fecha del reporte."));
            }

            // =========================================
            // 2. BÚSQUEDA DINÁMICA DE COLUMNAS
            // =========================================
            let headerRowIndex = -1;
            let indices = { hora: 0, evento: 2, vel: 10, odo: 13, lat: 15, lng: 16 };

            for (let i = 0; i < Math.min(30, filas.length); i++) {
                const filaStr = filas[i].map(cleanText);
                
                if (filaStr.some(c => c.includes('latitud') || c === 'lat') && 
                    filaStr.some(c => c.includes('longitud') || c === 'lng' || c === 'lon')) {
                    
                    headerRowIndex = i;
                    
                    const colHora = filaStr.findIndex(c => c.includes('hora') || c.includes('tiempo') || c === 'time');
                    const colEvento = filaStr.findIndex(c => c.includes('descripción') || c.includes('descripcion') || c.includes('evento'));
                    const colVel = filaStr.findIndex(c => c.includes('velocidad') || c.includes('speed') || c.includes('km/h'));
                    const colOdo = filaStr.findIndex(c => c.includes('kilómetros') || c.includes('kilometraje') || c.includes('odómetro') || c === 'km');
                    const colLat = filaStr.findIndex(c => c.includes('latitud') || c === 'lat');
                    const colLng = filaStr.findIndex(c => c.includes('longitud') || c === 'lng' || c === 'lon');

                    if (colHora !== -1) indices.hora = colHora;
                    if (colEvento !== -1) indices.evento = colEvento;
                    if (colVel !== -1) indices.vel = colVel;
                    if (colOdo !== -1) indices.odo = colOdo;
                    if (colLat !== -1) indices.lat = colLat;
                    if (colLng !== -1) indices.lng = colLng;
                    
                    break;
                }
            }

            if (headerRowIndex === -1) {
                return reject(new Error("No se encontraron las columnas de Latitud y Longitud en la tabla de datos."));
            }

            // =========================================
            // 3. EXTRACCIÓN DE DATOS
            // =========================================
            const jsonRutaCompleta = [];
            const viajesEstructurados = [];
            let viajeEnCurso = null; 

            for (let i = headerRowIndex + 1; i < filas.length; i++) {
                const fila = filas[i];
                if (!fila || fila.length === 0) continue;
                
                const hora = formatearHoraSQL(fila[indices.hora]);
                
                const descripcionEvento = String(fila[indices.evento] || '').trim();
                const latitud = parseFloat(fila[indices.lat]);
                const longitud = parseFloat(fila[indices.lng]);
                
                let velocidad = parseFloat(String(fila[indices.vel]).replace(',', '.')) || 0;
                let odometro = parseFloat(String(fila[indices.odo]).replace(',', '.')) || 0;

                if (isNaN(latitud) || isNaN(longitud)) continue;
                if (!descripcionEvento || descripcionEvento === 'External Voltage Level') continue; 

                const eventoLimpio = { h: hora, evt: descripcionEvento, lat: latitud, lng: longitud, vel: velocidad, odo: odometro };
                jsonRutaCompleta.push(eventoLimpio);

                if (descripcionEvento === 'Inicio de Viaje' || descripcionEvento === 'Ignition On') {
                    viajeEnCurso = { hora_inicio: hora, latitud_inicio: latitud, longitud_inicio: longitud, odometro_inicio: odometro };
                } 
                else if ((descripcionEvento === 'Fin de Viaje' || descripcionEvento === 'Ignition Off') && viajeEnCurso) {
                    viajesEstructurados.push({
                        hora_inicio: viajeEnCurso.hora_inicio, latitud_inicio: viajeEnCurso.latitud_inicio, longitud_inicio: viajeEnCurso.longitud_inicio,
                        hora_fin: hora,
                        latitud_final: latitud, longitud_final: longitud
                    });
                    viajeEnCurso = null; 
                }
            }

            resolve({
                placa: placaVehiculo,
                fecha: fechaRuta,
                datosRutaJSON: JSON.stringify(jsonRutaCompleta),
                viajesAnaliticos: viajesEstructurados
            });

        } catch (error) {
            reject(new Error("Error decodificando el archivo Excel: " + error.message));
        }
    });
};

module.exports = {
    procesarArchivoRuta
};