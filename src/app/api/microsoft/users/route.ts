import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      console.warn('Faltan variables de entorno para Azure AD');
      return NextResponse.json({ success: false, users: [] }, { status: 500 });
    }

    // 1. Get Azure AD token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      next: { revalidate: 3600 }, // Cache token for 1 hour
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Error obteniendo token de Azure AD:', tokenData);
      return NextResponse.json({ success: false, users: [] }, { status: 500 });
    }

    // 2. Fetch users from Microsoft Graph
    const usersRes = await fetch(
      'https://graph.microsoft.com/v1.0/users?$top=999&$select=displayName,mail,userPrincipalName,department,jobTitle',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        next: { revalidate: 300 }, // Cache list for 5 minutes
      }
    );

    const usersData = await usersRes.json();
    if (!usersData.value) {
      console.error('Error obteniendo usuarios de Microsoft Graph:', usersData);
      return NextResponse.json({ success: false, users: [] }, { status: 500 });
    }

    // 3. Format and clean users
    const users = (usersData.value as any[])
      .map((u) => {
        const email = (u.mail || u.userPrincipalName || '').trim().toLowerCase();
        const nombre = (u.displayName || '').trim();
        const area = (u.department || u.jobTitle || '').trim();
        return {
          nombre,
          email,
          area: area || 'General',
        };
      })
      .filter((u) => u.nombre && u.email && u.email.includes('@'))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    console.error('Error en API /api/microsoft/users:', err);
    return NextResponse.json({ success: false, users: [], error: err.message }, { status: 500 });
  }
}
