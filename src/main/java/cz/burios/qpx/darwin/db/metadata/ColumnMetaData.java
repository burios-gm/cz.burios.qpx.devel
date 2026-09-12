package cz.burios.qpx.darwin.db.metadata;

/** Metadata of one database column. */
public class ColumnMetaData {
    public String name;
    public String label;
    public String type;
    public int jdbcType;
    public String jdbcTypeName;
    public int length;
    public int precision;
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
    public ColumnMetaData type(String value) { this.type = value; return this; }
    public ColumnMetaData jdbcType(int value) { this.jdbcType = value; return this; }
    public ColumnMetaData jdbcTypeName(String value) { this.jdbcTypeName = value; return this; }
    public ColumnMetaData length(int value) { this.length = value; return this; }
    public ColumnMetaData precision(int value) { this.precision = value; return this; }
    public ColumnMetaData scale(int value) { this.scale = value; return this; }
    public ColumnMetaData nullable(boolean value) { this.nullable = value; return this; }
    public ColumnMetaData primaryKey(boolean value) { this.primaryKey = value; return this; }
    public ColumnMetaData autoIncrement(boolean value) { this.autoIncrement = value; return this; }
    public ColumnMetaData ordinalPosition(int value) { this.ordinalPosition = value; return this; }
    public ColumnMetaData defaultValue(String value) { this.defaultValue = value; return this; }
    public ColumnMetaData generation(ColumnGeneration value) { this.generation = value == null ? ColumnGeneration.NONE : value; return this; }
}
