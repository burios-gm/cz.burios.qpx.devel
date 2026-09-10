package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.uniql.*;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Unified SQL-like fluent DSL facade for SELECT and CRUD statements.
 *
 * <pre>
 * DSL.select("id", "name").from("users").where(DSL.col("active").eq(true));
 * DSL.insertInto("users").columns("name").values("Alice");
 * DSL.update("users").set("active", true).where(DSL.col("id").eq(1));
 * DSL.deleteFrom("users").where(DSL.col("id").eq(1));
 * </pre>
 */
public final class DSL {
    private DSL() {}

    // ---------------------------------------------------------------------
    // SELECT / expressions
    // ---------------------------------------------------------------------

    public static Select select(QLExpr... expressions) {
        Select builder = new Select();
        if (expressions != null) builder.select.columns.addAll(Arrays.asList(expressions));
        return builder;
    }

    public static Select select(String... columnNames) {
        Select builder = new Select();
        if (columnNames != null) {
            for (String name : columnNames) builder.select.columns.add(col(name));
        }
        return builder;
    }

    public static Select select() { return new Select(); }

    public static QLColumn col(String name) { return new QLColumn(name); }
    public static QLColumn column(String name) { return col(name); }
    public static QLTable table(String name) { return new QLTable(name); }
    public static QLValue val(Object value) { return new QLValue(value); }
    public static QLValue value(Object value) { return val(value); }
    public static QLFunction fn(String name, QLExpr... args) { return new QLFunction(name, args); }
    public static QLFunction function(String name, QLExpr... args) { return fn(name, args); }
    public static QLSubSelect subSelect(QLSelect select) { return new QLSubSelect(select); }
    public static QLExpression expression(QLExpr left, String operator, Object right) {
        return new QLExpression(left, operator, QLExpr.toExpr(right));
    }
    public static QLBrackets brackets(QLExpr expression) { return new QLBrackets(expression); }
    public static QLCondition condition(QLExpr left, String operator, Object right) {
        return new QLCondition(left, operator, QLExpr.toExpr(right));
    }
    public static QLWhere where(QLExpr... expressions) { return new QLWhere(expressions); }
    public static QLGroupBy groupBy(QLExpr... expressions) { return new QLGroupBy(expressions); }
    public static QLOrderBy orderBy(QLExpr expression, String direction) {
        return new QLOrderBy().add(expression, direction);
    }
    public static QLCase caseExpr() { return new QLCase(); }
    public static QLExists exists(QLSelect select) { return new QLExists(select); }

    public static QLCondition eq(QLExpr left, Object right) { return left.eq(right); }
    public static QLCondition ne(QLExpr left, Object right) { return left.ne(right); }
    public static QLCondition gt(QLExpr left, Object right) { return left.gt(right); }
    public static QLCondition ge(QLExpr left, Object right) { return left.ge(right); }
    public static QLCondition lt(QLExpr left, Object right) { return left.lt(right); }
    public static QLCondition le(QLExpr left, Object right) { return left.le(right); }
    public static QLCondition like(QLExpr left, Object right) { return left.like(right); }

    // ---------------------------------------------------------------------
    // INSERT / UPDATE / DELETE
    // ---------------------------------------------------------------------

    public static Insert insertInto(String table) { return new Insert(table); }
    public static Update update(String table) { return new Update(table); }
    public static Delete deleteFrom(String table) { return new Delete(table); }

    /** Fluent SELECT builder. */
    public static final class Select {
        private final QLSelect select = new QLSelect();

        public Select column(QLExpr expression) { select.columns.add(expression); return this; }
        public Select column(String name) { return column(col(name)); }
        public Select columns(QLExpr... expressions) {
            if (expressions != null) select.columns.addAll(Arrays.asList(expressions));
            return this;
        }
        public Select distinct() { select.distinct = true; return this; }
        public Select from(QLExpr source) { select.from = source; return this; }
        public Select from(String tableName) { return from(table(tableName)); }
        public Select join(QLExpr source, QLExpr on) { return join("INNER", source, on); }
        public Select join(String type, QLExpr source, QLExpr on) {
            select.joins.add(new QLJoin(type, source, on));
            return this;
        }
        public Select leftJoin(QLExpr source, QLExpr on) { return join("LEFT", source, on); }
        public Select rightJoin(QLExpr source, QLExpr on) { return join("RIGHT", source, on); }
        public Select fullJoin(QLExpr source, QLExpr on) { return join("FULL", source, on); }
        public Select crossJoin(QLExpr source) { return join("CROSS", source, null); }
        public Select where(QLExpr expression) {
            if (select.where == null) select.where = new QLWhere();
            select.where.add(expression);
            return this;
        }
        public Select and(QLExpr expression) { return where(expression); }
        public Select groupBy(QLExpr... expressions) {
            if (select.groupBy == null) select.groupBy = new QLGroupBy();
            if (expressions != null) select.groupBy.expressions.addAll(Arrays.asList(expressions));
            return this;
        }
        public Select having(QLExpr expression) { select.having = expression; return this; }
        public Select orderBy(QLExpr expression, String direction) {
            if (select.orderBy == null) select.orderBy = new QLOrderBy();
            select.orderBy.add(expression, direction);
            return this;
        }
        public Select orderByAsc(QLExpr expression) { return orderBy(expression, "ASC"); }
        public Select orderByDesc(QLExpr expression) { return orderBy(expression, "DESC"); }
        public Select limit(int value) { select.limit = new QLLimit(value); return this; }
        public Select offset(int value) { select.offset = new QLOffset(value); return this; }
        public QLSelect build() { return select; }
        public QLSql.Result sql() { return QLSql.render(select); }

        public List<BasicRecord> list(Connection connection) throws SQLException {
            return execute(connection, BasicRecord.class);
        }

        public <T extends BasicRecord> List<T> list(Connection connection, Class<T> type) throws SQLException {
            return execute(connection, type);
        }

        public <T extends BasicRecord> T one(Connection connection, Class<T> type) throws SQLException {
            List<T> rows = execute(connection, type);
            if (rows.isEmpty()) return null;
            if (rows.size() > 1) throw new SQLException("Expected one row, got " + rows.size());
            return rows.get(0);
        }

        public <T extends BasicRecord> List<T> execute(Connection connection, Class<T> type) throws SQLException {
            if (connection == null) throw new IllegalArgumentException("connection must not be null");
            QLSql.Result rendered = sql();
            try (PreparedStatement statement = connection.prepareStatement(rendered.sql())) {
                bind(statement, rendered);
                try (ResultSet rs = statement.executeQuery()) {
                    return QLRowMapper.map(rs, type);
                }
            }
        }
    }

    /** Fluent INSERT builder. */
    public static final class Insert {
        private final QLInsert statement;
        private Insert(String table) { statement = new QLInsert(new QLTable(table)); }
        public Insert columns(String... columns) { statement.columns(columns); return this; }
        public Insert values(Object... values) { statement.values(values); return this; }
        public Insert row(Map<String, ?> values) { statement.row(values); return this; }
        public QLInsert build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return executeUpdate(connection, sql()); }
    }

    /** Fluent UPDATE builder. */
    public static final class Update {
        private final QLUpdate statement;
        private Update(String table) { statement = new QLUpdate(new QLTable(table)); }
        public Update set(String column, Object value) { statement.set(column, value); return this; }
        public Update set(Map<String, ?> values) { values.forEach(statement::set); return this; }
        public Update where(QLExpr expression) { statement.where(expression); return this; }
        public QLUpdate build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return executeUpdate(connection, sql()); }
    }

    /** Fluent DELETE builder. */
    public static final class Delete {
        private final QLDelete statement;
        private Delete(String table) { statement = new QLDelete(new QLTable(table)); }
        public Delete where(QLExpr expression) { statement.where(expression); return this; }
        public QLDelete build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return executeUpdate(connection, sql()); }
    }

    private static int executeUpdate(Connection connection, QLSql.Result rendered) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        try (PreparedStatement statement = connection.prepareStatement(rendered.sql())) {
            bind(statement, rendered);
            return statement.executeUpdate();
        }
    }

    private static void bind(PreparedStatement statement, QLSql.Result rendered) throws SQLException {
        for (int i = 0; i < rendered.parameters().size(); i++) {
            statement.setObject(i + 1, rendered.parameters().get(i));
        }
    }
}
