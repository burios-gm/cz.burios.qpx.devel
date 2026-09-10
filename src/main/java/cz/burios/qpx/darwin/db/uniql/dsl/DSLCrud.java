package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.uniql.*;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/** Fluent SQL-like facade for INSERT, UPDATE and DELETE. */
public final class DSLCrud {
    private DSLCrud() {}

    public static Insert insertInto(String table) { return new Insert(table); }
    public static Update update(String table) { return new Update(table); }
    public static Delete deleteFrom(String table) { return new Delete(table); }

    public static final class Insert {
        private final QLInsert statement;
        private Insert(String table) { statement = new QLInsert(new QLTable(table)); }
        public Insert columns(String... columns) { statement.columns(columns); return this; }
        public Insert values(Object... values) { statement.values(values); return this; }
        public Insert row(Map<String, ?> values) { statement.row(values); return this; }
        public QLInsert build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return execute(connection, sql()); }
    }

    public static final class Update {
        private final QLUpdate statement;
        private Update(String table) { statement = new QLUpdate(new QLTable(table)); }
        public Update set(String column, Object value) { statement.set(column, value); return this; }
        public Update set(Map<String, ?> values) { values.forEach(statement::set); return this; }
        public Update where(QLExpr expression) { statement.where(expression); return this; }
        public QLUpdate build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return execute(connection, sql()); }
    }

    public static final class Delete {
        private final QLDelete statement;
        private Delete(String table) { statement = new QLDelete(new QLTable(table)); }
        public Delete where(QLExpr expression) { statement.where(expression); return this; }
        public QLDelete build() { return statement; }
        public QLSql.Result sql() { return QLSql.render(statement); }
        public int execute(Connection connection) throws SQLException { return execute(connection, sql()); }
    }

    private static int execute(Connection connection, QLSql.Result rendered) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        try (PreparedStatement ps = connection.prepareStatement(rendered.sql())) {
            for (int i = 0; i < rendered.parameters().size(); i++) ps.setObject(i + 1, rendered.parameters().get(i));
            return ps.executeUpdate();
        }
    }
}
