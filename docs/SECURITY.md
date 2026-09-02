# Security & Privacy Specification

This document details the security layers, encryption protocols, and privacy controls implemented in the VIGITRA platform.

---

## 1. Authentication & Authorization

- **JWT Token Scopes**: Standard HMAC-SHA256 tokens authenticate operators. Default lifetime is set to `24 hours`.
- **Role-Based Access Control (RBAC)**:
  - `ADMIN`: Complete control, user management, and setting safety thresholds.
  - `OPERATOR`: Access to dashboards, adding cameras, and registering plate watchlists.
  - `ANALYST`: View reports, analytics matrices, and ML predictions.
  - `VIEWER`: Read-only access to GIS maps.

---

## 2. Privacy & Data Minimization

- **license Plate Masking**: Plates are stored normalized in database indexes for search, but user search accesses are audited.
- **Audit Logging**: Any user action (login, camera addition, watchlist updates, alert acknowledgments) is logged in the `audit_logs` table (`user_id`, `action`, `details`, `ip_address`, `timestamp`).
- **Data Retention**: Configurable retention limits clear out historic plate sightings to ensure city-wide privacy compliance.
