import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/setup", "/api/telegram-webhook", "/_next", "/favicon.ico", "/Logo_DynoBoo.png"];

// Daftar pemetaan endpoint API ke modul
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/api/workshops': 'produk_ws',
  '/api/stocks': 'produk_ws',
  '/api/items': 'produk_ws',
  '/api/item-types': 'produk_ws',
  '/api/knowledge': 'produk_ws',
  '/api/invoices': 'invoice',
  '/api/invoice-types': 'invoice',
  '/api/payments': 'invoice',
  '/api/pesanan': 'invoice',
  '/api/customers': 'customer',
  '/api/ai-chat': 'chatbot',
  '/api/chat-logs': 'chatbot',
  '/api/admin-users': 'pengaturan',
  '/api/company': 'pengaturan',
};

function getActionFromMethod(method: string): string {
  switch (method) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Izinkan path publik & static assets (root "/" ditangani SPA)
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cek session cookie — cukup cek keberadaan dan nilai tidak kosong
  const session = request.cookies.get("dynoboo_session")?.value;
  if (!session || session.length < 8) {
    // Return 401 if it's an API request, else redirect to login
    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ==== PBAC Logic (Permission-Based Access Control) ====
  if (pathname.startsWith('/api/')) {
    let moduleName = '';
    for (const [route, mod] of Object.entries(ROUTE_MODULE_MAP)) {
      if (pathname.startsWith(route)) {
        moduleName = mod;
        break;
      }
    }

    if (moduleName) {
      const action = getActionFromMethod(request.method);
      const requiredPermission = `${moduleName}:${action}`;
      
      const username = request.cookies.get('dynoboo_user')?.value;
      if (!username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/admin_users?username=eq.${encodeURIComponent(username)}&select=role,permissions`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              const user = data[0];
              
              if (user.role !== 'superadmin') {
                let perms: string[] = [];
                if (Array.isArray(user.permissions)) perms = user.permissions;
                else if (typeof user.permissions === 'string') {
                  try { perms = JSON.parse(user.permissions); } catch { perms = []; }
                }

                if (!perms.includes('all') && !perms.includes(requiredPermission)) {
                  return NextResponse.json({ error: `Forbidden: Requires ${requiredPermission}` }, { status: 403 });
                }
              }
            }
          }
        } catch (err) {
          console.error('Proxy permission check error:', err);
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|Logo_DynoBoo.png).*)"],
};
