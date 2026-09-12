package cz.burios.qpx.darwin.db.metadata;

import java.sql.Types;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;
import cz.burios.qpx.darwin.db.dialect.PostgreSQLDialect;

/** Executable logical-column-type test; no JUnit required. */
public class ColumnTypeTest {
    public static void main(String[] args) {
        MySQLDialect mysql = new MySQLDialect();
        PostgreSQLDialect postgres = new PostgreSQLDialect();

        ColumnMetaData datetime = new ColumnMetaData("CREATED_AT").logicalType(ColumnType.DATETIME).nullable(false);
        if (!"`CREATED_AT` DATETIME NOT NULL".equals(mysql.columnDefinition(datetime)))
            throw new AssertionError(mysql.columnDefinition(datetime));
        if (!"\"CREATED_AT\" TIMESTAMP NOT NULL".equals(postgres.columnDefinition(datetime)))
            throw new AssertionError(postgres.columnDefinition(datetime));

        ColumnMetaData string = new ColumnMetaData("NAME").logicalType(ColumnType.STRING).length(120).nullable(false);
        if (!"`NAME` VARCHAR(120) NOT NULL".equals(mysql.columnDefinition(string))) throw new AssertionError(mysql.columnDefinition(string));
        if (!"\"NAME\" VARCHAR(120) NOT NULL".equals(postgres.columnDefinition(string))) throw new AssertionError(postgres.columnDefinition(string));

        ColumnMetaData nativeDatetime = new ColumnMetaData("CREATED_AT").type("DATETIME").jdbcType(Types.TIMESTAMP).jdbcTypeName("DATETIME");
        if (mysql.logicalType(nativeDatetime) != ColumnType.DATETIME) throw new AssertionError("MySQL DATETIME mapping failed");
        ColumnMetaData nativeTimestamp = new ColumnMetaData("CREATED_AT").type("timestamp").jdbcType(Types.TIMESTAMP).jdbcTypeName("TIMESTAMP");
        if (mysql.logicalType(nativeTimestamp) != ColumnType.TIMESTAMP) throw new AssertionError("MySQL TIMESTAMP mapping failed");

        ColumnMetaData generated = new ColumnMetaData("UPDATED_AT").logicalType(ColumnType.DATETIME)
                .nullable(false).generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
        if (!mysql.columnDefinition(generated).contains("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
            throw new AssertionError(mysql.columnDefinition(generated));

        System.out.println("ColumnTypeTest: OK");
    }
}
