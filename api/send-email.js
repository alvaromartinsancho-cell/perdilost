export default async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error: 'Endpoint retirado'
  });
}
