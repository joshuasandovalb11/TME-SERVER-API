const { sql, poolPromiseRutas } = require('../../../sistema_rutas/db_rutas');

const activarDispositivo = async (idVendedor, pin, idDispositivo, modelo) => {
  const pool = await poolPromiseRutas;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Verificar vendedor y PIN
    const resultVendedor = await transaction.request()
      .input('idVendedor', sql.VarChar(50), idVendedor)
      .input('pin', sql.VarChar(50), pin)
      .query(`
        SELECT id_vendedor 
        FROM vendedores 
        WHERE id_vendedor = @idVendedor 
          AND pin_activacion_movil = @pin 
          AND expiracion_pin > GETDATE()
      `);

    if (resultVendedor.recordset.length === 0) {
      throw new Error('PIN inválido o expirado, o el vendedor no existe.');
    }

    // 2. Limpiar el PIN del vendedor
    await transaction.request()
      .input('idVendedor', sql.VarChar(50), idVendedor)
      .query(`
        UPDATE vendedores 
        SET pin_activacion_movil = NULL, 
            expiracion_pin = NULL 
        WHERE id_vendedor = @idVendedor
      `);

    // 3. Desactivar dispositivos anteriores
    await transaction.request()
      .input('idVendedor', sql.VarChar(50), idVendedor)
      .query(`
        UPDATE dispositivos 
        SET estatus = 0 
        WHERE id_vendedor = @idVendedor
      `);

    // 4. Insertar nuevo dispositivo
    await transaction.request()
      .input('idDispositivo', sql.VarChar(100), idDispositivo)
      .input('idVendedor', sql.VarChar(50), idVendedor)
      .input('modeloDispositivo', sql.VarChar(100), modelo)
      .query(`
        INSERT INTO dispositivos (id_dispositivo, id_vendedor, modelo_dispositivo, estatus) 
        VALUES (@idDispositivo, @idVendedor, @modeloDispositivo, 1)
      `);

    await transaction.commit();
    return { success: true, message: 'Dispositivo activado correctamente.' };

  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('❌ Error en activarDispositivo:', error.message || error);
    throw error;
  }
};

module.exports = {
  activarDispositivo
};
