package cz.burios.qpx.darwin.db.metadata;

import java.util.Objects;

/** Immutable definition of one ordered, named database schema migration. */
public final class DBSchemaMigration {
    private final String id;
    private final String description;
    private final DBMetaData desired;
    private final boolean includeDrops;

    public DBSchemaMigration(String id, String description, DBMetaData desired) {
        this(id, description, desired, false);
    }

    public DBSchemaMigration(String id, String description, DBMetaData desired, boolean includeDrops) {
        validateId(id);
        if (desired == null) throw new IllegalArgumentException("desired metadata must not be null");
        this.id = id;
        this.description = description == null ? "" : description;
        this.desired = desired;
        this.includeDrops = includeDrops;
    }

    public String id() { return id; }
    public String description() { return description; }
    public DBMetaData desired() { return desired; }
    public boolean includeDrops() { return includeDrops; }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof DBSchemaMigration that)) return false;
        return includeDrops == that.includeDrops
                && id.equals(that.id)
                && description.equals(that.description)
                && Objects.equals(desired, that.desired);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, description, desired, includeDrops);
    }

    @Override
    public String toString() {
        return id + (description.isBlank() ? "" : " - " + description);
    }

    private static void validateId(String id) {
        if (id == null || id.isBlank() || id.length() > 128) {
            throw new IllegalArgumentException("migrationId must be 1..128 characters");
        }
    }
}
