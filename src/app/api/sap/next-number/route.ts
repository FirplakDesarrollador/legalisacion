import { NextResponse } from 'next/server';
import { loginSAP } from '@/lib/sapServiceLayer';

export async function GET() {
  try {
    const session = await loginSAP();
    const baseUrl = (process.env.SAP_API_URL || 'https://200.7.96.194:50000/b1s/v1/Login').replace(/\/Login\/?$/, '');

    // Query highest Code from U_HBT_LEGENC in SAP
    const resMaxEnc = await fetch(`${baseUrl}/U_HBT_LEGENC?$top=1&$orderby=Code desc`, {
      headers: { Cookie: session.cookieHeader },
    });

    let nextCode = '0000000001';
    let codeInt = 1;

    if (resMaxEnc.ok) {
      const dataMax = await resMaxEnc.json();
      if (dataMax.value && dataMax.value.length > 0) {
        codeInt = parseInt(dataMax.value[0].Code, 10) + 1;
        nextCode = codeInt.toString().padStart(10, '0');
      }
    }

    return NextResponse.json({
      success: true,
      nextCode: nextCode,
      codeInt: codeInt,
      codigo: `LEG-${codeInt}`,
    });
  } catch (err: any) {
    console.warn('No se pudo obtener el siguiente número directo de SAP:', err.message);
    const fallbackNum = Math.floor(1000 + Math.random() * 9000);
    return NextResponse.json({
      success: false,
      nextCode: fallbackNum.toString(),
      codeInt: fallbackNum,
      codigo: `LEG-${fallbackNum}`,
    });
  }
}
