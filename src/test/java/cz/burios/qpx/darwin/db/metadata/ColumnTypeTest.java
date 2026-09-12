package cz.burios.qpx.darwin.db.metadata;

import java.sql.Types;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;
import cz.burios.qpx.darwin.db.dialect.PostgreSQLDialect;

/** Executable logical-column-type test; no JUnit required. */
public class ColumnTypeTest {
    public static void main(String[] args) {
        MySQLDialect mysql = new MySQLDialect();
        PostgreSQLDialect postgres = new PostgreSQLDialect();

        ColumnMetaData datetime = new ColumnMetaData("CREATED_AT").datetime().nullable(false);
        if (!"`CREATED_AT` DATETIME NOT NULL".equals(mysql.columnDefinition(datetime))) throw new AssertionError(mysql.columnDefinition(datetime));
        if (!"\"CREATED_AT\" TIMESTAMP NOT NULL".equals(postgres.columnDefinition(datetime))) throw new AssertionError(postgres.columnDefinition(datetime));

        ColumnMetaData string = new ColumnMetaData("NAME").string(120).nullable(false);
        if (!"`NAME` VARCHAR(120) NOT NULL".equals(mysql.columnDefinition(string))) throw new AssertionError(mysql.columnDefinition(string));
        if (!"\"NAME\" VARCHAR(120) NOT NULL".equals(postgres.columnDefinition(string))) throw new AssertionError(postgres.columnDefinition(string));

        ColumnMetaData decimal = new ColumnMetaData("AMOUNT").decimal(12, 2);
        if (!"`AMOUNT` DECIMAL(12,2)".equals(mysql.columnDefinition(decimal))) throw new AssertionError(mysql.columnDefinition(decimal));
        if (!"\"AMOUNT\" NUMERIC(12,2)".equals(postgres.columnDefinition(decimal))) throw new AssertionError(postgres.columnDefinition(decimal));

        ColumnMetaData binary = new ColumnMetaData("DATA").binary(64);
        if (!"`DATA` VARBINARY(64)".equals(mysql.columnDefinition(binary))) throw new AssertionError(mysql.columnDefinition(binary));
        if (!"\"DATA\" BYTEA".equals(postgres.columnDefinition(binary))) throw new AssertionError(postgres.columnDefinition(binary));

        ColumnMetaData nativeDatetime = new ColumnMetaData("CREATED_AT").type("DATETIME").jdbcType(Types.TIMESTAMP).jdbcTypeName("DATETIME");
        if (mysql.logicalType(nativeDatetime) != ColumnType.DATETIME) throw new AssertionError("MySQL DATETIME mapping failed");
        ColumnMetaData nativeTimestamp = new ColumnMetaData("CREATED_AT").type("timestamp").jdbcType(Types.TIMESTAMP).jdbcTypeName("TIMESTAMP");
        if (mysql.logicalType(nativeTimestamp) != ColumnType.TIMESTAMP) throw new AssertionError("MySQL TIMESTAMP mapping failed");

        ColumnMetaData generated = new ColumnMetaData("UPDATED_AT").datetime().nullable(false)
                .generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
        if (!mysql.columnDefinition(generated).contains("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
            throw new AssertionError(mysql.columnDefinition(generated));

        System.out.println("ColumnTypeTest: OK");
    }
}
