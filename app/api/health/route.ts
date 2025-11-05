export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, status: 'ok', timestamp: new Date().toISOString() }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )
}

