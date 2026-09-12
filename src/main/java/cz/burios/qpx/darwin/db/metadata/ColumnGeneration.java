package cz.burios.qpx.darwin.db.metadata;

/** Database-independent semantic for automatic column value generation. */
public enum ColumnGeneration {
    NONE,
    INSERT_TIMESTAMP,
    INSERT_UPDATE_TIMESTAMP
}
