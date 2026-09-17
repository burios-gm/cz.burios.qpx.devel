package cz.burios.uniql.model;

import cz.burios.uniql.metadata.TableMetaData;

/** Runtime record whose table definition comes from DB metadata rather than a Java POJO. */
public class DynamicRecord extends BasicRecord {
    private transient TableMetaData tableMetaData;

    public DynamicRecord() {}

    public DynamicRecord(TableMetaData tableMetaData) {
        this.tableMetaData = tableMetaData;
    }

    public TableMetaData getTableMetaData() { return tableMetaData; }
    public void setTableMetaData(TableMetaData tableMetaData) { this.tableMetaData = tableMetaData; }
}
