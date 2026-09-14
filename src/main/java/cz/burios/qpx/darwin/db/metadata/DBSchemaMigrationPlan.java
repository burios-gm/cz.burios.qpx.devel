package cz.burios.qpx.darwin.db.metadata;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Immutable dry-run result for one declared schema migration. */
public record DBSchemaMigrationPlan(DBSchemaMigration migration, SchemaDiff diff, String planHash) {
    public DBSchemaMigrationPlan {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        if (planHash == null || !planHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
        if (!planHash.equalsIgnoreCase(diff.planHash()))
            throw new IllegalArgumentException("planHash does not match diff");
    }

    /** Serializes the complete approval artifact, including migration identity and executable changes. */
    public String toJson() {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("migrationId", migration.id());
        json.put("description", migration.description());
        json.put("includeDrops", migration.includeDrops());
        json.put("planHash", planHash);
        json.put("changes", diff.changes());
        try {
            return new ObjectMapper().writeValueAsString(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize schema migration approval plan", e);
        }
    }
}
