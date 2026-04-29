// models/userModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Insert or update a user record.
 */
function upsertUser({ id, username, discriminator, displayName, joinedAt, createdAt }) {
    try {
        db.prepare(
            `INSERT INTO users (id, username, discriminator, display_name, joined_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                discriminator = excluded.discriminator,
                display_name = excluded.display_name,
                joined_at = excluded.joined_at,
                updated_at = datetime('now')`
        ).run(id, username, discriminator || null, displayName || null, joinedAt || null, createdAt || null);
        return true;
    } catch (error) {
        logger.error(`userModel.upsertUser error: ${error.message}`, { id });
        return false;
    }
}

/**
 * Get a user by Discord ID.
 */
function getUserById(id) {
    try {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
    } catch (error) {
        logger.error(`userModel.getUserById error: ${error.message}`);
        return null;
    }
}

/**
 * Get all users.
 */
function getAllUsers() {
    try {
        return db.prepare('SELECT * FROM users ORDER BY username ASC').all();
    } catch (error) {
        logger.error(`userModel.getAllUsers error: ${error.message}`);
        return [];
    }
}

module.exports = { upsertUser, getUserById, getAllUsers };
