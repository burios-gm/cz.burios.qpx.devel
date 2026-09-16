package cz.burios.qpx.darwin.db.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashMap;
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

    /**
     * Stable identity of the declared migration, independent of the current database state.
     * This is deliberately different from SchemaDiff.planHash(), which hashes executable changes.
     */
    public String definitionHash() {
        try {
            ObjectMapper mapper = new ObjectMapper()
                    .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
                    .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
            LinkedHashMap<String, Object> value = new LinkedHashMap<>();
            value.put("id", id);
            value.put("description", description);
            value.put("includeDrops", includeDrops);
            value.put("desired", desired);
            byte[] bytes = mapper.writeValueAsBytes(value);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder result = new StringBuilder(64);
            for (byte b : digest) result.append(String.format("%02x", b));
            return result.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to calculate migration definition hash", e);
        }
    }

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
