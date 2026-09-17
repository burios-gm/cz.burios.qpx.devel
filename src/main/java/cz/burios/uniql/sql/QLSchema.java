package cz.burios.qpx.darwin.db.uniql;

import java.util.Objects;
import java.util.regex.Pattern;

/** Qualified SQL name: table, database.table, or database.table.column. */
public class QLSchema extends QLExpr {
    private static final Pattern NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");

    public String database;
    public String table;
    public String column;

    public QLSchema() {}
    public QLSchema(String database, String table) { this.database = database; this.table = table; }
    public QLSchema(String database, String table, String column) {
        this.database = database; this.table = table; this.column = column;
    }

    /** Parses table, database.table, or database.table.column. */
    public static QLSchema parse(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("SQL name must not be blank");
        String[] parts = name.split("\\.", -1);
        if (parts.length > 3) throw new IllegalArgumentException("SQL name must contain at most 3 parts: " + name);
        for (String part : parts) if (!NAME.matcher(part).matches()) throw new IllegalArgumentException("Invalid SQL name: " + name);
        return switch (parts.length) {
            case 1 -> new QLSchema(null, parts[0], null);
            case 2 -> new QLSchema(parts[0], parts[1], null);
            case 3 -> new QLSchema(parts[0], parts[1], parts[2]);
            default -> throw new AssertionError();
        };
    }

    public QLSchema database(String database) { validate(database, "database"); this.database = database; return this; }
    public QLSchema table(String table) { validate(table, "table"); this.table = table; return this; }
    public QLSchema column(String column) { validate(column, "column"); this.column = column; return this; }
    public QLSchema asTable() { return new QLSchema(database, table, null); }
    public QLSchema asColumn(String column) { return new QLSchema(database, table, column); }

    public String sqlName() {
        if (table == null || table.isBlank()) throw new IllegalStateException("Table name is required");
        validate(table, "table");
        if (database != null) validate(database, "database");
        if (column != null) validate(column, "column");
        StringBuilder result = new StringBuilder();
        if (database != null) result.append(database).append('.');
        result.append(table);
        if (column != null) result.append('.').append(column);
        return result.toString();
    }

    private static void validate(String value, String kind) {
        if (value == null || !NAME.matcher(value).matches()) throw new IllegalArgumentException("Invalid SQL " + kind + ": " + value);
    }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
    @Override public String toString() { return sqlName(); }
    @Override public boolean equals(Object o) {
        if (!(o instanceof QLSchema other)) return false;
        return Objects.equals(database, other.database) && Objects.equals(table, other.table) && Objects.equals(column, other.column);
    }
    @Override public int hashCode() { return Objects.hash(database, table, column); }
}
