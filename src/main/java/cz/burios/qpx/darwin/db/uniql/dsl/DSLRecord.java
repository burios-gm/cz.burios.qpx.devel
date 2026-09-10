package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.uniql.BasicRecord;
import cz.burios.qpx.darwin.db.uniql.QLExpr;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

/** CRUD convenience facade for BasicRecord instances. */
public final class DSLRecord {
    private DSLRecord() {}

    public static int insert(Connection connection, String table, BasicRecord record) throws SQLException {
        if (record == null) throw new IllegalArgumentException("record must not be null");
        return DSL.insertInto(table).row(record).execute(connection);
    }

    public static int update(Connection connection, String table, BasicRecord record, String keyColumn) throws SQLException {
        if (record == null) throw new IllegalArgumentException("record must not be null");
        if (keyColumn == null || keyColumn.isBlank()) throw new IllegalArgumentException("keyColumn must not be blank");
        Object key = record.get(keyColumn);
        if (key == null) throw new IllegalArgumentException("record key must not be null: " + keyColumn);
        DSLRecordUpdate update = new DSLRecordUpdate(table, keyColumn, key);
        for (Map.Entry<String,Object> e : record.entrySet()) {
            if (!keyColumn.equals(e.getKey())) update.set(e.getKey(), e.getValue());
        }
        return update.execute(connection);
    }

    public static int delete(Connection connection, String table, BasicRecord record, String keyColumn) throws SQLException {
        if (record == null) throw new IllegalArgumentException("record must not be null");
        if (keyColumn == null || keyColumn.isBlank()) throw new IllegalArgumentException("keyColumn must not be blank");
        Object key = record.get(keyColumn);
        if (key == null) throw new IllegalArgumentException("record key must not be null: " + keyColumn);
        return DSL.deleteFrom(table).where(DSL.col(keyColumn).eq(key)).execute(connection);
    }

    private static final class DSLRecordUpdate {
        private final DSLCrud.Update delegate;
        private DSLRecordUpdate(String table, String keyColumn, Object key) {
            delegate = DSL.update(table).where(DSL.col(keyColumn).eq(key));
        }
        private void set(String column, Object value) { delegate.set(column, value); }
        private int execute(Connection connection) throws SQLException { return delegate.execute(connection); }
    }
}
