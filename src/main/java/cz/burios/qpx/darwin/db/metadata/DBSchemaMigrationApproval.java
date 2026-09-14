package cz.burios.qpx.darwin.db.metadata;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Immutable approval artifact containing only migration identity and executable schema changes. */
public record DBSchemaMigrationApproval(String migrationId, String description, boolean includeDrops,
        SchemaDiff diff, String planHash) {
    public DBSchemaMigrationApproval {
        if (migrationId == null || migrationId.isBlank() || migrationId.length() > 128)
            throw new IllegalArgumentException("migrationId must be 1..128 characters");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        if (planHash == null || !planHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
        if (!planHash.equalsIgnoreCase(diff.planHash()))
            throw new IllegalArgumentException("planHash does not match diff");
        description = description == null ? "" : description;
    }

    public static DBSchemaMigrationApproval fromPlan(DBSchemaMigrationPlan plan) {
        if (plan == null) throw new IllegalArgumentException("plan must not be null");
        return new DBSchemaMigrationApproval(plan.migration().id(), plan.migration().description(),
                plan.migration().includeDrops(), plan.diff(), plan.planHash());
    }

    public String toJson() {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("migrationId", migrationId);
        json.put("description", description);
        json.put("includeDrops", includeDrops);
        json.put("planHash", planHash);
        json.put("changes", diff.changes());
        try { return new ObjectMapper().writeValueAsString(json); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot serialize schema migration approval", e); }
    }

    public static DBSchemaMigrationApproval fromJson(String json) {
        if (json == null || json.isBlank()) throw new IllegalArgumentException("json must not be blank");
        try {
            JsonNode root = new ObjectMapper().readTree(json);
            requireObject(root, "plan");
            String migrationId = text(root, "migrationId", true);
            String description = text(root, "description", true);
            JsonNode includeDropsNode = root.get("includeDrops");
            if (includeDropsNode == null || !includeDropsNode.isBoolean())
                throw new IllegalArgumentException("includeDrops must be a boolean");
            boolean includeDrops = includeDropsNode.booleanValue();
            String planHash = text(root, "planHash", true);
            JsonNode changesNode = root.get("changes");
            if (changesNode == null || !changesNode.isArray()) throw new IllegalArgumentException("changes must be an array");
            List<SchemaChange> changes = new ArrayList<>();
            for (JsonNode node : changesNode) changes.add(readChange(node));
            return new DBSchemaMigrationApproval(migrationId, description, includeDrops, SchemaDiff.fromChanges(changes), planHash);
        } catch (JsonProcessingException e) { throw new IllegalArgumentException("Invalid schema migration approval JSON", e); }
    }

    private static SchemaChange readChange(JsonNode node) {
        requireObject(node, "change");
        String typeName = text(node, "type", true);
        final SchemaChange.Type type;
        try { type = SchemaChange.Type.valueOf(typeName); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Unknown schema change type: " + typeName, e); }
        TableMetaData table = node.hasNonNull("table") ? readTable(node.get("table")) : null;
        return switch (type) {
            case CREATE_TABLE -> SchemaChange.createTable(requireTable(table, type));
            case DROP_TABLE -> SchemaChange.dropTable(requireTable(table, type));
            case ADD_COLUMN -> SchemaChange.addColumn(requireTable(table, type), readColumn(requireNode(node, "column", type)));
            case ALTER_COLUMN -> SchemaChange.alterColumn(requireTable(table, type), readColumn(requireNode(node, "column", type)));
            case DROP_COLUMN -> SchemaChange.dropColumn(requireTable(table, type), text(node, "columnName", true));
            case ALTER_TABLE_PARAMS -> SchemaChange.alterTableParams(requireTable(table, type));
            case CREATE_INDEX -> SchemaChange.createIndex(requireTable(table, type), readIndex(requireNode(node, "index", type)));
            case DROP_INDEX -> SchemaChange.dropIndex(requireTable(table, type), text(node, "indexName", true));
        };
    }

    private static TableMetaData readTable(JsonNode node) {
        requireObject(node, "table");
        TableMetaData table = new TableMetaData();
        table.database = nullableText(node, "database"); table.schema = nullableText(node, "schema");
        table.name = nullableText(node, "name"); table.label = nullableText(node, "label");
        readParams(node.get("params"), table.params); readParams(node.get("actualParams"), table.actualParams);
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
        column.name = nullableText(node, "name"); column.label = nullableText(node, "label"); column.type = nullableText(node, "type");
        column.logicalType = enumValue(node, "logicalType", ColumnType.class); column.jdbcType = node.path("jdbcType").asInt(0);
        column.jdbcTypeName = nullableText(node, "jdbcTypeName"); column.length = node.path("length").asInt(0);
        column.precision = node.path("precision").asInt(0); column.scale = node.path("scale").asInt(0);
        column.collation = nullableText(node, "collation"); column.nullable = node.path("nullable").asBoolean(true);
        column.primaryKey = node.path("primaryKey").asBoolean(false); column.autoIncrement = node.path("autoIncrement").asBoolean(false);
        column.ordinalPosition = node.path("ordinalPosition").asInt(0); column.defaultValue = nullableText(node, "defaultValue");
        column.generation = enumValue(node, "generation", ColumnGeneration.class);
        if (column.generation == null) column.generation = ColumnGeneration.NONE;
        return column;
    }

    private static IndexMetaData readIndex(JsonNode node) {
        requireObject(node, "index");
        IndexMetaData index = new IndexMetaData(); index.name = nullableText(node, "name");
        index.unique = node.path("unique").asBoolean(false); index.type = nullableText(node, "type"); index.method = nullableText(node, "method");
        JsonNode columns = node.get("columns");
        if (columns != null) { if (!columns.isArray()) throw new IllegalArgumentException("index.columns must be an array"); for (JsonNode column : columns) index.columns.add(column.asText()); }
        return index;
    }

    private static void readParams(JsonNode node, Map<String, Object> target) {
        if (node == null || node.isNull()) return;
        if (!node.isObject()) throw new IllegalArgumentException("table params must be an object");
        node.fields().forEachRemaining(entry -> target.put(entry.getKey(), jsonValue(entry.getValue())));
    }
    private static Object jsonValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isBoolean()) return node.booleanValue(); if (node.isIntegralNumber()) return node.numberValue();
        if (node.isFloatingPointNumber()) return node.numberValue(); if (node.isTextual()) return node.textValue(); return node.toString();
    }
    private static JsonNode requireNode(JsonNode node, String field, SchemaChange.Type type) {
        JsonNode result = node.get(field); if (result == null || result.isNull()) throw new IllegalArgumentException(type + " " + field + " is required"); return result;
    }
    private static TableMetaData requireTable(TableMetaData table, SchemaChange.Type type) { if (table == null) throw new IllegalArgumentException(type + " table is required"); return table; }
    private static void requireObject(JsonNode node, String what) { if (node == null || !node.isObject()) throw new IllegalArgumentException(what + " must be an object"); }
    private static String text(JsonNode node, String field, boolean required) { String value = nullableText(node, field); if (required && (value == null || value.isBlank())) throw new IllegalArgumentException(field + " must not be blank"); return value == null ? "" : value; }
    private static String nullableText(JsonNode node, String field) { JsonNode value = node.get(field); return value == null || value.isNull() ? null : value.asText(); }
    private static <E extends Enum<E>> E enumValue(JsonNode node, String field, Class<E> type) { String value = nullableText(node, field); if (value == null || value.isBlank()) return null; try { return Enum.valueOf(type, value); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid " + field + ": " + value, e); } }
}
