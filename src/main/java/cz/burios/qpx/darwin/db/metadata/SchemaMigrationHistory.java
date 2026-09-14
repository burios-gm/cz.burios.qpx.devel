package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Persistent execution history for metadata-driven schema migrations. */
public final class SchemaMigrationHistory {
    public static final String TABLE_NAME = "QPX_SCHEMA_MIGRATION";

    public enum Status { RUNNING, APPLIED, FAILED }

    public record Entry(String migrationId, String planHash, Status status,
            Instant createdAt, Instant completedAt, String errorMessage) { }

    /** Creates the history table when it is not present. */
    public void ensureTable(Connection connection) throws SQLException {
        requireConnection(connection);
        DatabaseMetaData metadata = connection.getMetaData();
        boolean exists = false;
        try (ResultSet rs = metadata.getTables(connection.getCatalog(), connection.getSchema(), null,
                new String[] { "TABLE" })) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME");
                if (TABLE_NAME.equalsIgnoreCase(name)) {
                    exists = true;
                    break;
                }
            }
        }
        if (exists) return;
        String sql = "CREATE TABLE " + TABLE_NAME + " ("
                + "MIGRATION_ID VARCHAR(128) PRIMARY KEY, "
                + "PLAN_HASH VARCHAR(64) NOT NULL, "
                + "STATUS VARCHAR(16) NOT NULL, "
                + "CREATED_AT TIMESTAMP NOT NULL, "
                + "COMPLETED_AT TIMESTAMP NULL, "
                + "ERROR_MESSAGE VARCHAR(4000) NULL)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    /** Starts a migration history entry. Migration IDs are immutable keys. */
    public Entry start(Connection connection, String migrationId, String planHash) throws SQLException {
        validateId(migrationId);
        validateHash(planHash);
        Instant now = Instant.now();
        String sql = "INSERT INTO " + TABLE_NAME
                + " (MIGRATION_ID, PLAN_HASH, STATUS, CREATED_AT) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, migrationId);
            statement.setString(2, planHash);
            statement.setString(3, Status.RUNNING.name());
            statement.setTimestamp(4, Timestamp.from(now));
            statement.executeUpdate();
        }
        return new Entry(migrationId, planHash, Status.RUNNING, now, null, null);
    }

    public void markApplied(Connection connection, String migrationId) throws SQLException {
        markApplied(connection, migrationId, Instant.now());
    }

    public void markApplied(Connection connection, String migrationId, Instant completedAt) throws SQLException {
        validateId(migrationId);
        updateStatus(connection, migrationId, Status.APPLIED, completedAt, null);
    }

    public void markFailed(Connection connection, String migrationId, String errorMessage) throws SQLException {
        markFailed(connection, migrationId, Instant.now(), errorMessage);
    }

    public void markFailed(Connection connection, String migrationId, Instant completedAt, String errorMessage) throws SQLException {
        validateId(migrationId);
        updateStatus(connection, migrationId, Status.FAILED, completedAt, truncate(errorMessage));
    }

    /** Returns an entry by migration ID, or null when no such migration exists. */
    public Entry find(Connection connection, String migrationId) throws SQLException {
        validateId(migrationId);
        String sql = "SELECT MIGRATION_ID, PLAN_HASH, STATUS, CREATED_AT, COMPLETED_AT, ERROR_MESSAGE"
                + " FROM " + TABLE_NAME + " WHERE MIGRATION_ID = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, migrationId);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? read(rs) : null;
            }
        }
    }

    /** Returns all history entries in creation order. */
    public List<Entry> list(Connection connection) throws SQLException {
        String sql = "SELECT MIGRATION_ID, PLAN_HASH, STATUS, CREATED_AT, COMPLETED_AT, ERROR_MESSAGE"
                + " FROM " + TABLE_NAME + " ORDER BY CREATED_AT, MIGRATION_ID";
        List<Entry> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet rs = statement.executeQuery()) {
            while (rs.next()) result.add(read(rs));
        }
        return Collections.unmodifiableList(result);
    }

    private static void updateStatus(Connection connection, String migrationId, Status status,
            Instant completedAt, String errorMessage) throws SQLException {
        requireConnection(connection);
        String sql = "UPDATE " + TABLE_NAME
                + " SET STATUS = ?, COMPLETED_AT = ?, ERROR_MESSAGE = ? WHERE MIGRATION_ID = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, status.name());
            statement.setTimestamp(2, Timestamp.from(completedAt));
            if (errorMessage == null) statement.setNull(3, java.sql.Types.VARCHAR);
            else statement.setString(3, errorMessage);
            statement.setString(4, migrationId);
            if (statement.executeUpdate() != 1)
                throw new SQLException("Migration history entry not found: " + migrationId);
        }
    }

    private static Entry read(ResultSet rs) throws SQLException {
        Timestamp created = rs.getTimestamp("CREATED_AT");
        Timestamp completed = rs.getTimestamp("COMPLETED_AT");
        return new Entry(rs.getString("MIGRATION_ID"), rs.getString("PLAN_HASH"),
                Status.valueOf(rs.getString("STATUS")),
                created == null ? null : created.toInstant(),
                completed == null ? null : completed.toInstant(),
                rs.getString("ERROR_MESSAGE"));
    }

    private static String truncate(String message) {
        if (message == null) return null;
        return message.length() <= 4000 ? message : message.substring(0, 4000);
    }

    private static void validateId(String migrationId) {
        if (migrationId == null || migrationId.isBlank() || migrationId.length() > 128)
            throw new IllegalArgumentException("migrationId must be 1..128 characters");
    }

    private static void validateHash(String planHash) {
        if (planHash == null || planHash.length() != 64)
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
    }

    private static void requireConnection(Connection connection) {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
    }
}
