package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.DBDialects;

/** Persistent execution history for metadata-driven schema migrations. */
public final class SchemaMigrationHistory {
    public static final String TABLE_NAME = "QPX_SCHEMA_MIGRATION";
    public enum Status { RUNNING, APPLIED, FAILED }
    public record Entry(String migrationId, String planHash, String definitionHash, Status status,
            java.time.Instant createdAt, java.time.Instant completedAt, String errorMessage) { }

    public void ensureTable(Connection connection) throws SQLException {
        requireConnection(connection);
        DatabaseMetaData metadata = connection.getMetaData();
        DBDialect dialect = DBDialects.forConnection(connection);
        String catalog = dialect.catalog(connection);
        String schema = dialect.schema(connection);
        if (!tableExists(metadata, catalog, schema)) {
            String sql = "CREATE TABLE " + TABLE_NAME + " (MIGRATION_ID VARCHAR(128) PRIMARY KEY, PLAN_HASH VARCHAR(64) NOT NULL, DEFINITION_HASH VARCHAR(64) NULL, STATUS VARCHAR(16) NOT NULL, CREATED_AT BIGINT NOT NULL, COMPLETED_AT BIGINT NULL, ERROR_MESSAGE VARCHAR(4000) NULL)";
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                try {
                    statement.executeUpdate();
                } catch (SQLException createFailure) {
                    // Another application instance may have created the history table after
                    // our existence check. Re-read metadata and only suppress that race.
                    if (!tableExists(metadata, catalog, schema)) throw createFailure;
                }
            }
        }
        if (!columnExists(metadata, catalog, schema, "DEFINITION_HASH")) {
            try (PreparedStatement statement = connection.prepareStatement(
                    "ALTER TABLE " + TABLE_NAME + " ADD COLUMN DEFINITION_HASH VARCHAR(64) NULL")) {
                try {
                    statement.executeUpdate();
                } catch (SQLException alterFailure) {
                    // Likewise, another initializer may have added the compatibility column.
                    if (!columnExists(metadata, catalog, schema, "DEFINITION_HASH")) throw alterFailure;
                }
            }
        }
    }

    public Entry start(Connection connection, String migrationId, String planHash) throws SQLException {
        return start(connection, migrationId, planHash, null);
    }

    /** Starts a migration and records both its executable plan hash and its declared-definition hash. */
    public Entry start(Connection connection, String migrationId, String planHash, String definitionHash) throws SQLException {
        validateId(migrationId); validateHash(planHash); validateOptionalHash(definitionHash);
        Entry existing = find(connection, migrationId);
        if (existing != null) {
            if (existing.status() == Status.APPLIED && existing.planHash().equalsIgnoreCase(planHash)
                    && (definitionHash == null || definitionHash.equalsIgnoreCase(existing.definitionHash()))) return existing;
            throw duplicateMigration(migrationId, existing);
        }
        java.time.Instant now = java.time.Instant.now();
        String normalizedId = normalizeId(migrationId);
        String sql = "INSERT INTO " + TABLE_NAME + " (MIGRATION_ID, PLAN_HASH, DEFINITION_HASH, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, normalizedId); statement.setString(2, planHash);
            if (definitionHash == null) statement.setNull(3, java.sql.Types.VARCHAR); else statement.setString(3, definitionHash);
            statement.setString(4, Status.RUNNING.name()); statement.setLong(5, now.toEpochMilli());
            statement.executeUpdate();
        } catch (SQLException insertFailure) {
            // The existence check above is intentionally only an optimization. The primary key
            // is the concurrency guard: another connection may have inserted the same normalized ID
            // between find() and INSERT. Turn that race into the same domain-level error.
            Entry concurrent = find(connection, migrationId);
            if (concurrent != null) throw duplicateMigration(migrationId, concurrent);
            throw insertFailure;
        }
        return new Entry(migrationId, planHash, definitionHash, Status.RUNNING, now, null, null);
    }

    /** Reopens a FAILED migration using the currently pending plan and unchanged declaration hash. */
    public Entry retry(Connection connection, String migrationId, String planHash) throws SQLException {
        return retry(connection, migrationId, planHash, null);
    }

    /** Reopens a FAILED migration and replaces the persisted plan hash with the currently pending plan. */
    public Entry retry(Connection connection, String migrationId, String planHash, String definitionHash) throws SQLException {
        validateId(migrationId); validateHash(planHash); validateOptionalHash(definitionHash);
        Entry existing = find(connection, migrationId);
        if (existing == null) throw new SchemaMigrationException("Migration history entry not found: " + migrationId);
        if (existing.status() != Status.FAILED) {
            throw new SchemaMigrationException("Only FAILED migration can be retried: " + migrationId
                    + " (status=" + existing.status() + ")");
        }
        if (definitionHash != null && !definitionHash.equalsIgnoreCase(existing.definitionHash())) {
            throw new SchemaMigrationException("Migration definition hash changed: " + migrationId
                    + " (stored=" + existing.definitionHash() + ", current=" + definitionHash + ")");
        }
        updateRetry(connection, migrationId, planHash);
        return new Entry(existing.migrationId(), planHash, existing.definitionHash(), Status.RUNNING,
                existing.createdAt(), null, null);
    }

    public void markApplied(Connection connection, String migrationId) throws SQLException { markApplied(connection, migrationId, java.time.Instant.now()); }
    public void markApplied(Connection connection, String migrationId, java.time.Instant completedAt) throws SQLException {
        validateId(migrationId); updateStatus(connection, migrationId, Status.APPLIED, completedAt, null);
    }
    public void markFailed(Connection connection, String migrationId, String errorMessage) throws SQLException { markFailed(connection, migrationId, java.time.Instant.now(), errorMessage); }
    public void markFailed(Connection connection, String migrationId, java.time.Instant completedAt, String errorMessage) throws SQLException {
        validateId(migrationId); updateStatus(connection, migrationId, Status.FAILED, completedAt, truncate(errorMessage));
    }

    public Entry find(Connection connection, String migrationId) throws SQLException {
        validateId(migrationId);
        String sql = "SELECT MIGRATION_ID, PLAN_HASH, DEFINITION_HASH, STATUS, CREATED_AT, COMPLETED_AT, ERROR_MESSAGE FROM " + TABLE_NAME + " WHERE LOWER(MIGRATION_ID) = LOWER(?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, migrationId);
            try (ResultSet rs = statement.executeQuery()) { return rs.next() ? read(rs) : null; }
        }
    }

    public List<Entry> list(Connection connection) throws SQLException {
        String sql = "SELECT MIGRATION_ID, PLAN_HASH, DEFINITION_HASH, STATUS, CREATED_AT, COMPLETED_AT, ERROR_MESSAGE FROM " + TABLE_NAME + " ORDER BY CREATED_AT, MIGRATION_ID";
        List<Entry> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet rs = statement.executeQuery()) {
            while (rs.next()) result.add(read(rs));
        }
        return Collections.unmodifiableList(result);
    }

    private static void updateRetry(Connection connection, String migrationId, String planHash) throws SQLException {
        requireConnection(connection);
        String sql = "UPDATE " + TABLE_NAME + " SET PLAN_HASH = ?, STATUS = ?, COMPLETED_AT = NULL, ERROR_MESSAGE = NULL WHERE LOWER(MIGRATION_ID) = LOWER(?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, planHash);
            statement.setString(2, Status.RUNNING.name());
            statement.setString(3, migrationId);
            if (statement.executeUpdate() != 1) throw new SQLException("Migration history entry not found: " + migrationId);
        }
    }

    private static void updateStatus(Connection connection, String migrationId, Status status, java.time.Instant completedAt, String errorMessage) throws SQLException {
        requireConnection(connection);
        String sql = "UPDATE " + TABLE_NAME + " SET STATUS = ?, COMPLETED_AT = ?, ERROR_MESSAGE = ? WHERE LOWER(MIGRATION_ID) = LOWER(?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, status.name());
            if (completedAt == null) statement.setNull(2, java.sql.Types.BIGINT); else statement.setLong(2, completedAt.toEpochMilli());
            if (errorMessage == null) statement.setNull(3, java.sql.Types.VARCHAR); else statement.setString(3, errorMessage);
            statement.setString(4, migrationId);
            if (statement.executeUpdate() != 1) throw new SQLException("Migration history entry not found: " + migrationId);
        }
    }

    private static boolean tableExists(DatabaseMetaData metadata, String catalog, String schema) throws SQLException {
        try (ResultSet rs = metadata.getTables(catalog, schema, null, new String[] { "TABLE" })) {
            while (rs.next()) if (TABLE_NAME.equalsIgnoreCase(rs.getString("TABLE_NAME"))) return true;
        }
        return false;
    }

    private static boolean columnExists(DatabaseMetaData metadata, String catalog, String schema, String columnName) throws SQLException {
        try (ResultSet rs = metadata.getColumns(catalog, schema, TABLE_NAME, "%")) {
            while (rs.next()) if (columnName.equalsIgnoreCase(rs.getString("COLUMN_NAME"))) return true;
        }
        return false;
    }

    private static Entry read(ResultSet rs) throws SQLException {
        long created = rs.getLong("CREATED_AT"); long completedValue = rs.getLong("COMPLETED_AT");
        java.time.Instant completed = rs.wasNull() ? null : java.time.Instant.ofEpochMilli(completedValue);
        return new Entry(rs.getString("MIGRATION_ID"), rs.getString("PLAN_HASH"), rs.getString("DEFINITION_HASH"),
                Status.valueOf(rs.getString("STATUS")), java.time.Instant.ofEpochMilli(created), completed, rs.getString("ERROR_MESSAGE"));
    }
    private static SchemaMigrationException duplicateMigration(String migrationId, Entry existing) {
        return new SchemaMigrationException("Migration ID already exists: " + migrationId
                + " (status=" + existing.status() + ", planHash=" + existing.planHash() + ")");
    }
    private static String truncate(String message) { return message == null || message.length() <= 4000 ? message : message.substring(0, 4000); }
    private static void validateId(String id) { if (id == null || id.isBlank() || id.length() > 128) throw new IllegalArgumentException("migrationId must be 1..128 characters"); }
    private static void validateHash(String hash) { if (hash == null || !hash.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("planHash must be a SHA-256 hex string"); }
    private static void validateOptionalHash(String hash) { if (hash != null && !hash.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("definitionHash must be a SHA-256 hex string"); }
    private static String normalizeId(String id) { return id.toLowerCase(Locale.ROOT); }
    private static void requireConnection(Connection connection) { if (connection == null) throw new IllegalArgumentException("connection must not be null"); }
}
