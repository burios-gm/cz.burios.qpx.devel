package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.uniql.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.util.Arrays;
import java.util.List;

/** Fluent facade over the QL SELECT AST. */
public final class DSLSelect {
    private DSLSelect() {}

    public static Builder select(QLExpr... expressions) {
        Builder b = new Builder();
        if (expressions != null) b.select.columns.addAll(Arrays.asList(expressions));
        return b;
    }
    public static Builder select(String... columnNames) {
        Builder b = new Builder();
        if (columnNames != null) for (String name : columnNames) b.select.columns.add(column(name));
        return b;
    }
    public static Builder select() { return new Builder(); }

    public static QLColumn column(String name) { return new QLColumn(name); }
    public static QLTable table(String name) { return new QLTable(name); }
    public static QLValue value(Object value) { return new QLValue(value); }
    public static QLFunction function(String name, QLExpr... args) { return new QLFunction(name, args); }
    public static QLSubSelect subSelect(QLSelect select) { return new QLSubSelect(select); }
    public static QLCondition condition(QLExpr left, String operator, QLExpr right) { return new QLCondition(left, operator, right); }
    public static QLWhere where(QLExpr... expressions) { return new QLWhere(expressions); }
    public static QLGroupBy groupBy(QLExpr... expressions) { return new QLGroupBy(expressions); }
    public static QLOrderBy orderBy(QLExpr expression, String direction) {
        QLOrderBy order = new QLOrderBy();
        order.items.add(new QLOrderBy.Item(expression, direction));
        return order;
    }

    public static QLCondition eq(QLExpr left, Object right) { return condition(left, "=", value(right)); }
    public static QLCondition ne(QLExpr left, Object right) { return condition(left, "<>", value(right)); }
    public static QLCondition gt(QLExpr left, Object right) { return condition(left, ">", value(right)); }
    public static QLCondition ge(QLExpr left, Object right) { return condition(left, ">=", value(right)); }
    public static QLCondition lt(QLExpr left, Object right) { return condition(left, "<", value(right)); }
    public static QLCondition le(QLExpr left, Object right) { return condition(left, "<=", value(right)); }
    public static QLCondition like(QLExpr left, Object right) { return condition(left, "LIKE", value(right)); }
    public static QLCondition and(QLCondition left, QLCondition right) { return left.and(right); }
    public static QLCondition or(QLCondition left, QLCondition right) { return left.or(right); }

    public static final class Builder {
        private final QLSelect select = new QLSelect();

        public Builder column(QLExpr expression) { select.columns.add(expression); return this; }
        public Builder column(String name) { return column(DSLSelect.column(name)); }
        public Builder columns(QLExpr... expressions) {
            if (expressions != null) select.columns.addAll(Arrays.asList(expressions));
            return this;
        }
        public Builder distinct() { select.distinct = true; return this; }
        public Builder from(QLExpr source) { select.from = source; return this; }
        public Builder from(String tableName) { return from(table(tableName)); }
        public Builder join(QLExpr source, QLCondition on) { return join("INNER", source, on); }
        public Builder join(String type, QLExpr source, QLCondition on) {
            select.joins.add(new QLJoin(type, source, on)); return this;
        }
        public Builder leftJoin(QLExpr source, QLCondition on) { return join("LEFT", source, on); }
        public Builder rightJoin(QLExpr source, QLCondition on) { return join("RIGHT", source, on); }
        public Builder where(QLExpr expression) {
            if (select.where == null) select.where = new QLWhere();
            select.where.add(expression); return this;
        }
        public Builder and(QLExpr expression) { return where(expression); }
        public Builder groupBy(QLExpr... expressions) {
            if (select.groupBy == null) select.groupBy = new QLGroupBy();
            if (expressions != null) select.groupBy.expressions.addAll(Arrays.asList(expressions));
            return this;
        }
        public Builder orderBy(QLExpr expression, String direction) {
            if (select.orderBy == null) select.orderBy = new QLOrderBy();
            select.orderBy.items.add(new QLOrderBy.Item(expression, direction));
            return this;
        }
        public Builder orderByAsc(QLExpr expression) { return orderBy(expression, "ASC"); }
        public Builder orderByDesc(QLExpr expression) { return orderBy(expression, "DESC"); }
        public Builder limit(int value) { select.limit = new QLLimit(value); return this; }
        public Builder offset(int value) { select.offset = new QLOffset(value); return this; }
        public QLSelect build() { return select; }
        public QLSql.Result sql() { return QLSql.render(select); }

        public List<BasicRecord> list(Connection connection) throws SQLException { return execute(connection, BasicRecord.class); }
        public <T extends BasicRecord> List<T> list(Connection connection, Class<T> type) throws SQLException { return execute(connection, type); }
        public <T extends BasicRecord> List<T> mapTo(Connection connection, Class<T> type) throws SQLException { return execute(connection, type); }
        public <T extends BasicRecord> T one(Connection connection, Class<T> type) throws SQLException {
            List<T> rows = execute(connection, type);
            if (rows.isEmpty()) return null;
            if (rows.size() > 1) throw new SQLException("Expected one row, got " + rows.size());
            return rows.get(0);
        }
        public <T extends BasicRecord> List<T> execute(Connection connection, Class<T> type) throws SQLException {
            QLSql.Result rendered = sql();
            try (PreparedStatement statement = connection.prepareStatement(rendered.sql())) {
                for (int i = 0; i < rendered.parameters().size(); i++) statement.setObject(i + 1, rendered.parameters().get(i));
                try (ResultSet rs = statement.executeQuery()) { return QLRowMapper.map(rs, type); }
            }
        }
    }
}
