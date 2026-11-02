import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function checkDesktopInventory({db,s,sql,user,branch,branch2,warehouse,product,supplierId,customerId,config,applyDesktopOperation,desktopBootstrap,device1}){
 const run=operation=>applyDesktopOperation(user,device1,[branch],operation);
 await db.insert(s.codigosProductoFiscal).values({empresaId:user.empresaId,codigo:'GENERAL_TAXABLE',nombre:'Producto gravado general',categoria:'general'}).onConflictDoNothing();
 const category=await run(config('crearCategoria',[{nombre:'Categoría Desktop QA'}]));
 const brand=await run(config('crearMarca',[{nombre:'Marca Desktop QA'}]));
 const form={sku:'QA-EDITABLE',nombre:'Producto editable QA',descripcion:'Descripción que se conserva',tipo:'simple',categoriaId:category.id,marcaId:brand.id,precioBase:15,costoPromedio:5,stockMinimo:2,metodoCosteo:'promedio',manejaLotes:false,manejaSeries:false,productoFiscalCodigo:'GENERAL_TAXABLE'};
 const created=await run(config('crearProducto',[form]));assert.ok(created.id);
 const edit=config('actualizarProducto',[created.id,{...form,nombre:'Producto editado QA'}]);await run(edit);await run(edit);
 const [saved]=await db.execute(sql`select nombre,descripcion,categoria_id,marca_id from productos where id=${created.id}::uuid`);assert.equal(saved.nombre,'Producto editado QA');assert.equal(saved.descripcion,form.descripcion);assert.equal(saved.categoria_id,category.id);assert.equal(saved.marca_id,brand.id);
 const imported=config('importarProductosInventario',[{filas:[{fila:2,sku:'QA-EXCEL-001',nombre:'Producto Excel QA',descripcion:'Desde Excel',precioBase:15,costoPromedio:5,existenciaInicial:4,stockMinimo:1}]}]);
 const importResult=await run(imported);assert.equal(importResult.creados,1);await run(imported);
 const [excel]=await db.execute(sql`select p.id,(select sum(cantidad) from existencias where producto_id=p.id) as stock from productos p where p.empresa_id=${user.empresaId}::uuid and p.nombre='Producto Excel QA'`);assert.equal(Number(excel.stock),4);
 const proposal=config('crearProductosDesdeAsistente',[{productos:[{nombre:'Propuesta confirmada QA',sku:'QA-AI-001',codigoBarras:'777888999001',descripcion:'Confirmada por el usuario',precioBase:20,costoPromedio:6,stockMinimo:1,existenciaInicial:2}]}]);
 const proposalResult=await run(proposal);assert.equal(proposalResult.creados,1);await run(proposal);
 const [ai]=await db.execute(sql`select (select count(*) from productos where empresa_id=${user.empresaId}::uuid and nombre='Propuesta confirmada QA') as n,(select sum(cantidad) from existencias where producto_id=${proposalResult.productos[0].id}::uuid) as stock`);assert.equal(Number(ai.n),1);assert.equal(Number(ai.stock),2);
 // Same scanner purchase as web, with a supplier already used for this product.
 await db.execute(sql`update productos set codigo_barras='QA-SCAN-CORE' where id=${product}::uuid`);
 const [before]=await db.execute(sql`select cantidad from existencias where producto_id=${product}::uuid and almacen_id=${warehouse}::uuid`);
 const scan=config('registrarCompraRapidaInventarioPorLector',[{productoId:product,almacenId:warehouse,proveedorId:supplierId,codigoBarras:'QA-SCAN-CORE',cantidad:2,costoUnitario:4}]);
 const scanResult=await run(scan);assert.ok(scanResult.compraId);assert.equal((await run(scan)).compraId,scanResult.compraId);
 const [after]=await db.execute(sql`select cantidad,(select count(*) from compras where id=${scanResult.compraId}::uuid) as purchases from existencias where producto_id=${product}::uuid and almacen_id=${warehouse}::uuid`);assert.equal(Number(after.cantidad),Number(before.cantidad)+2);assert.equal(Number(after.purchases),1);
 const wrongWarehouse=config('registrarCompraRapidaInventarioPorLector',[{...scan.payload.args[0],almacenId:randomUUID()}]);await assert.rejects(run(wrongWarehouse),/Almacén no autorizado/);
 const editCustomer=config('actualizarCliente',[customerId,{nombre:'Cliente editado Desktop QA',telefono:'12345678'}]);await run(editCustomer);await run(editCustomer);
 const [customer]=await db.execute(sql`select nombre,telefono from clientes where id=${customerId}::uuid`);assert.equal(customer.nombre,'Cliente editado Desktop QA');assert.equal(customer.telefono,'12345678');
 await assert.rejects(run(config('actualizarCliente',[randomUUID(),{nombre:'Ajeno'}])),/no pertenece/);
 await db.insert(s.restauranteProductos).values({empresaId:user.empresaId,productoId:created.id,tipo:'insumo'});
 const bootstrap=await desktopBootstrap(user,[branch],{deviceId:device1});
 assert.equal(bootstrap.productos.find(row=>row.id===created.id).inventario_visible,false);assert.equal(JSON.parse(bootstrap.productos.find(row=>row.id===created.id).detalle_json).descripcion,form.descripcion);
 assert.ok(bootstrap.settings.inventario_catalogos[0].categorias.some(row=>row.id===category.id));
 console.log(JSON.stringify({desktopProductEditorWebService:'passed',excelImportIdempotency:'passed',confirmedAiProposalWebService:'passed',barcodePurchaseIdempotency:'passed',inventoryWarehouseScope:'passed',customerEditPreservesFields:'passed',inventoryMetadataBootstrap:'passed'}));
}
