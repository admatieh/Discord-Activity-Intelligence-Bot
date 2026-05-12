// utils/mockDiscord.js
// Minimal Discord.js-like mocks for internal dashboard/API command execution.
// This is trusted only because bot API is protected by x-api-key (local/private).

class MockCollection extends Map {
  filter(fn) {
    const result = new MockCollection()
    for (const [key, value] of this.entries()) {
      if (fn(value, key, this)) result.set(key, value)
    }
    return result
  }

  map(fn) {
    return Array.from(this.values()).map(fn)
  }

  some(fn) {
    return Array.from(this.values()).some(fn)
  }

  find(fn) {
    return Array.from(this.values()).find(fn)
  }

  first() {
    return this.values().next().value
  }
}

function toRoleCollection(roles) {
  const col = new MockCollection()

  if (!roles) return col

  // Accept: array of { id, name }, Map/Collection of roles, object keyed by roleId.
  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (r && r.id) col.set(String(r.id), r)
    }
    return col
  }

  if (typeof roles.values === 'function') {
    for (const r of roles.values()) {
      if (r && r.id) col.set(String(r.id), r)
    }
    return col
  }

  if (typeof roles === 'object') {
    for (const [k, v] of Object.entries(roles)) {
      if (v && typeof v === 'object' && v.id) col.set(String(v.id), v)
      else col.set(String(k), v)
    }
  }

  return col
}

module.exports = {
  MockCollection,
  toRoleCollection,
}

