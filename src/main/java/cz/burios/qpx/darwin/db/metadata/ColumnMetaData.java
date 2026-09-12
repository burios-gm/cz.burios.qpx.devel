package cz.burios.qpx.darwin.db.metadata;

/** Metadata of one database column. */
public class ColumnMetaData {
    public String name;
    public String label;
    /** Native SQL type name, primarily describing an existing database column. */
    public String type;
    /** Database-independent logical type used for desired schema definitions. */
    public ColumnType logicalType;
    public int jdbcType;
    public String jdbcTypeName;
    /** Length for character/binary types. */
    public int length;
    /** Precision for decimal types. */
    public int precision;
    /** Scale for decimal types. */
    public int scale;
    public boolean nullable = true;
    public boolean primaryKey;
    public boolean autoIncrement;
    public int ordinalPosition;
    /** Ordinary SQL default expression, e.g. 0 or ''. Timestamp generation belongs to {@link #generation}. */
    public String defaultValue;
    /** Database-independent semantic for automatic timestamp generation. */
    public ColumnGeneration generation = ColumnGeneration.NONE;

    public ColumnMetaData() {}
    public ColumnMetaData(String name) { this.name = name; this.label = name; }

    public ColumnMetaData name(String value) { this.name = value; return this; }
    public ColumnMetaData label(String value) { this.label = value; return this; }
    /** Sets a native SQL type override. Prefer {@link #logicalType(ColumnType)} for portable definitions. */
    public ColumnMetaData type(String value) { this.type = value; return this; }
    public ColumnMetaData logicalType(ColumnType value) { this.logicalType = value; return this; }
    public ColumnMetaData string(int length) { return logicalType(ColumnType.STRING).length(length); }
    public ColumnMetaData text() { return logicalType(ColumnType.TEXT); }
    public ColumnMetaData bool() { return logicalType(ColumnType.BOOLEAN); }
    public ColumnMetaData integer() { return logicalType(ColumnType.INTEGER); }
    public ColumnMetaData longType() { return logicalType(ColumnType.LONG); }
    public ColumnMetaData decimal(int precision, int scale) { return logicalType(ColumnType.DECIMAL).precision(precision).scale(scale); }
    public ColumnMetaData doubleType() { return logicalType(ColumnType.DOUBLE); }
    public ColumnMetaData date() { return logicalType(ColumnType.DATE); }
    public ColumnMetaData time() { return logicalType(ColumnType.TIME); }
    public ColumnMetaData datetime() { return logicalType(ColumnType.DATETIME); }
    public ColumnMetaData timestamp() { return logicalType(ColumnType.TIMESTAMP); }
    public ColumnMetaData binary(int length) { return logicalType(ColumnType.BINARY).length(length); }
    public ColumnMetaData jdbcType(int value) { this.jdbcType = value; return this; }
    public ColumnMetaData jdbcTypeName(String value) { this.jdbcTypeName = value; return this; }
    public ColumnMetaData length(int value) { if (value < 0) throw new IllegalArgumentException("length must not be negative"); this.length = value; return this; }
    public ColumnMetaData precision(int value) { if (value < 0) throw new IllegalArgumentException("precision must not be negative"); this.precision = value; return this; }
    public ColumnMetaData scale(int value) { if (value < 0) throw new IllegalArgumentException("scale must not be negative"); this.scale = value; return this; }
    public ColumnMetaData nullable(boolean value) { this.nullable = value; return this; }
    public ColumnMetaData primaryKey(boolean value) { this.primaryKey = value; return this; }
    public ColumnMetaData autoIncrement(boolean value) { this.autoIncrement = value; return this; }
    public ColumnMetaData ordinalPosition(int value) { this.ordinalPosition = value; return this; }
    public ColumnMetaData defaultValue(String value) { this.defaultValue = value; return this; }
    public ColumnMetaData generation(ColumnGeneration value) { this.generation = value == null ? ColumnGeneration.NONE : value; return this; }
}
