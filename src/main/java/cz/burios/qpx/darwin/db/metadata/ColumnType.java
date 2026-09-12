package cz.burios.qpx.darwin.db.metadata;

/** Database-independent logical type of a column. */
public enum ColumnType {
    STRING,
    TEXT,
    BOOLEAN,
    INTEGER,
    LONG,
    DECIMAL,
    DOUBLE,
    DATE,
    TIME,
    DATETIME,
    TIMESTAMP,
    BINARY
}
