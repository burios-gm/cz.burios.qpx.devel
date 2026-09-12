package cz.burios.qpx.darwin.db.metadata;

/**
 * Database-independent logical type of a column.
 * Dialects map these values to native SQL types; length/precision/scale remain
 * in {@link ColumnMetaData} as portable type parameters.
 */
public enum ColumnType {
    /** Variable-length textual value; use ColumnMetaData.length when bounded. */
    STRING,
    /** Unbounded or large textual value. */
    TEXT,
    BOOLEAN,
    /** Integer value normally represented by a 32-bit SQL integer. */
    INTEGER,
    /** Integer value normally represented by a 64-bit SQL integer. */
    LONG,
    /** Exact numeric value; use precision and scale. */
    DECIMAL,
    /** Floating-point numeric value. */
    DOUBLE,
    DATE,
    TIME,
    /** Date and time without a timezone; maps DATETIME/TIMESTAMP according to dialect semantics. */
    DATETIME,
    /** SQL timestamp; dialect may map this to its native timestamp type. */
    TIMESTAMP,
    /** Binary value; use ColumnMetaData.length when bounded. */
    BINARY
}
