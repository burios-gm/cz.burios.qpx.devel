package cz.burios.qpx.darwin.db.metadata;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
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

    /** Recreates an approval artifact from its persisted JSON representation. */
    public static DBSchemaMigrationPlan fromJson(String json) {
        if (json == null || json.isBlank()) throw new IllegalArgumentException("json must not be blank");
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);
            requireObject(root, "plan");
            String migrationId = text(root, "migrationId", true);
            String description = text(root, "description", false);
            boolean includeDrops = root.path("includeDrops").asBoolean(false);
            String planHash = text(root, "planHash", true);
            JsonNode changesNode = root.get("changes");
            if (changesNode == null || !changesNode.isArray()) throw new IllegalArgumentException("changes must be an array");

            List<SchemaChange> changes = new ArrayList<>();
            for (JsonNode node : changesNode) changes.add(readChange(node));
            SchemaDiff diff = SchemaDiff.fromChanges(changes);
            if (!planHash.equalsIgnoreCase(diff.planHash()))
                throw new IllegalArgumentException("planHash does not match serialized changes");
            return new DBSchemaMigrationPlan(new DBSchemaMigration(migrationId, description, new DBMetaData(), includeDrops), diff, planHash);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid schema migration plan JSON", e);
        }
    }

    private static SchemaChange readChange(JsonNode node) {
        requireObject(node, "change");
        String typeName = text(node, "type", true);
        final SchemaChange.Type type;
        try {
            type = SchemaChange.Type.valueOf(typeName);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown schema change type: " + typeName, e);
        }
        TableMetaData table = node.hasNonNull("table") ? readTable(node.get("table")) : null;
        return switch (type) {
            case CREATE_TABLE -> SchemaChange.createTable(requireTable(table, type));
            case DROP_TABLE -> SchemaChange.dropTable(requireTable(table, type));
            case ADD_COLUMN -> SchemaChange.addColumn(requireTable(table, type), requireColumn(readColumnNode(node), type));
            case ALTER_COLUMN -> SchemaChange.alterColumn(requireTable(table, type), requireColumn(readColumnNode(node), type));
            case DROP_COLUMN -> SchemaChange.dropColumn(requireTable(table, type), text(node, "columnName", true));
            case ALTER_TABLE_PARAMS -> SchemaChange.alterTableParams(requireTable(table, type));
            case CREATE_INDEX -> SchemaChange.createIndex(requireTable(table, type), requireIndex(readIndexNode(node), type));
            case DROP_INDEX -> SchemaChange.dropIndex(requireTable(table, type), text(node, "indexName", true));
        };
    }

    private static TableMetaData readTable(JsonNode node) {
        requireObject(node, "table");
        TableMetaData table = new TableMetaData();
        table.database = nullableText(node, "database");
        table.schema = nullableText(node, "schema");
        table.name = nullableText(node, "name");
        table.label = nullableText(node, "label");
        readParams(node.get("params"), table.params);
        readParams(node.get("actualParams"), table.actualParams);
        JsonNode columns = node.get("columns");
        if (columns != null && !columns.isArray()) throw new IllegalArgumentException("table.columns must be an array");
        if (columns != null) for (JsonNode column : columns) table.columns.add(readColumn(column));
        JsonNode indexes = node.get("indexes");
        if (indexes != null && !indexes.isArray()) throw new IllegalArgumentException("table.indexes must be an array");
        if (indexes != null) for (JsonNode index : indexes) table.indexes.add(readIndex(index));
        return table;
    }

    private static ColumnMetaData readColumn(JsonNode node) {
        requireObject(node, "column");
        ColumnMetaData column = new ColumnMetaData();
        column.name = nullableText(node, "name");
        column.label = nullableText(node, "label");
        column.type = nullableText(node, "type");
        column.logicalType = enumValue(node, "logicalType", ColumnType.class);
        column.jdbcType = node.path("jdbcType").asInt(0);
        column.jdbcTypeName = nullableText(node, "jdbcTypeName");
        column.length = node.path("length").asInt(0);
        column.precision = node.path("precision").asInt(0);
        column.scale = node.path("scale").asInt(0);
        column.collation = nullableText(node, "collation");
        column.nullable = node.path("nullable").asBoolean(true);
        column.primaryKey = node.path("primaryKey").asBoolean(false);
        column.autoIncrement = node.path("autoIncrement").asBoolean(false);
        column.ordinalPosition = node.path("ordinalPosition").asInt(0);
        column.defaultValue = nullableText(node, "defaultValue");
        column.generation = enumValue(node, "generation", ColumnGeneration.class);
        if (column.generation == null) column.generation = ColumnGeneration.NONE;
        return column;
    }

    private static IndexMetaData readIndex(JsonNode node) {
        requireObject(node, "index");
        IndexMetaData index = new IndexMetaData();
        index.name = nullableText(node, "name");
        index.unique = node.path("unique").asBoolean(false);
        index.type = nullableText(node, "type");
        index.method = nullableText(node, "method");
        JsonNode columns = node.get("columns");
        if (columns != null) {
            if (!columns.isArray()) throw new IllegalArgumentException("index.columns must be an array");
            for (JsonNode column : columns) index.columns.add(column.asText());
        }
        return index;
    }

    private static void readParams(JsonNode node, Map<String, Object> target) {
        if (node == null || node.isNull()) return;
        if (!node.isObject()) throw new IllegalArgumentException("table params must be an object");
        node.fields().forEachRemaining(entry -> target.put(entry.getKey(), jsonValue(entry.getValue())));
    }

    private static Object jsonValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isBoolean()) return node.booleanValue();
        if (node.isIntegralNumber()) return node.numberValue();
        if (node.isFloatingPointNumber()) return node.numberValue();
        if (node.isTextual()) return node.textValue();
        return node.toString();
    }

    private static JsonNode readColumnNode(JsonNode change) {
        JsonNode node = change.get("column");
        if (node == null || node.isNull()) throw new IllegalArgumentException("schema change column is required");
        return node;
    }

    private static JsonNode readIndexNode(JsonNode change) {
        JsonNode node = change.get("index");
        if (node == null || node.isNull()) throw new IllegalArgumentException("schema change index is required");
        return node;
    }

    private static ColumnMetaData requireColumn(JsonNode node, SchemaChange.Type type) {
        if (node == null) throw new IllegalArgumentException(type + " column is required");
        return readColumn(node);
    }

    private static IndexMetaData requireIndex(JsonNode node, SchemaChange.Type type) {
        if (node == null) throw new IllegalArgumentException(type + " index is required");
        return readIndex(node);
    }

    private static TableMetaData requireTable(TableMetaData table, SchemaChange.Type type) {
        if (table == null) throw new IllegalArgumentException(type + " table is required");
        return table;
    }

    private static void requireObject(JsonNode node, String what) {
        if (node == null || !node.isObject()) throw new IllegalArgumentException(what + " must be an object");
    }

    private static String text(JsonNode node, String field, boolean required) {
        String value = nullableText(node, field);
        if (required && (value == null || value.isBlank())) throw new IllegalArgumentException(field + " must not be blank");
        return value == null ? "" : value;
    }

    private static String nullableText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static <E extends Enum<E>> E enumValue(JsonNode node, String field, Class<E> type) {
        String value = nullableText(node, field);
        if (value == null || value.isBlank()) return null;
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid " + field + ": " + value, e);
        }
    }
}
