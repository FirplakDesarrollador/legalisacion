// Genera public/plantilla-legalizacion-gastos.xlsx con los catálogos actuales de Supabase.
// Uso:  npx tsx --env-file=.env scripts/generar-plantilla.ts
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { construirPlantilla } from '../src/lib/plantillaExcel';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: centros }, { data: cuentas }] = await Promise.all([
    supabase.from('Centro_costos').select('*').order('codigo', { ascending: true }),
    supabase.from('cuentas').select('*').order('id', { ascending: true }),
  ]);

  const wb = await construirPlantilla(ExcelJS, {
    centros: (centros || []).map((c: any) => ({ codigo: String(c.codigo).trim(), nombre: c['Título'] })),
    cuentas: (cuentas || []).map((c: any) => {
      const t = String(c['Título']);
      return { codigo: t.split(' - ')[0].trim(), nombre: t.includes(' - ') ? t.split(' - ').slice(1).join(' - ') : t };
    }),
  });

  mkdirSync('public', { recursive: true });
  const out = 'public/plantilla-legalizacion-gastos.xlsx';
  await wb.xlsx.writeFile(out);
  console.log(`Plantilla generada: ${out} (centros: ${centros?.length || 0}, cuentas: ${cuentas?.length || 0})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
