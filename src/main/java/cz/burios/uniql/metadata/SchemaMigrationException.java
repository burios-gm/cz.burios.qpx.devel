package cz.burios.uniql.metadata;

import java.sql.SQLException;

/** Signals an invalid or already-consumed persistent schema migration. */
public final class SchemaMigrationException extends SQLException {
    public SchemaMigrationException(String message) {
        super(message);
    }
}
