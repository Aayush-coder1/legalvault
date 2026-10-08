// Tenant context comes ONLY from verified JWT, never from body/URL alone.
function getTenant(req) {
  if (!req.auth || !req.auth.tenantId) throw Object.assign(new Error("No tenant"), { status: 401 });
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
}

function assertTenant(req, recordTenantId) {
  const { tenantId } = getTenant(req);
  if (recordTenantId !== tenantId) {
    throw Object.assign(new Error("Forbidden: other tenant data"), { status: 403 });
  }
}

module.exports = { getTenant, assertTenant };
