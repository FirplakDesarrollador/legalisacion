const fs = require('fs');
const files = [
  'src/components/TarjetasCreditoList.tsx',
  'src/components/NuevaTarjetaCreditoModal.tsx',
  'src/components/TarjetaCreditoDetailModal.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/Legalizaciones/g, 'TarjetasCredito');
  content = content.replace(/Legalizacion/g, 'TarjetaCredito');
  content = content.replace(/legalizaciones/g, 'tarjetasCredito');
  content = content.replace(/legalizacion/g, 'tarjetaCredito');
  // Revert the changes made earlier that said Cajas Menores for the old Legalizaciones text
  content = content.replace(/Cajas Menores/g, 'Tarjetas de crédito');
  content = content.replace(/cajas menores/g, 'tarjetas de crédito');
  content = content.replace(/Caja Menor/g, 'Tarjeta de crédito');
  content = content.replace(/caja menor/g, 'tarjeta de crédito');
  fs.writeFileSync(file, content);
}
console.log('Renaming complete');
