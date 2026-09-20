package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Locale;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

import cz.burios.uniql.dialect.MySQLDialect;

/**
 * Executable integration test for real MySQL JDBC metadata.
 *
 * Configure the connection with:
 *   -Dqpx.mysql.url=jdbc:mysql://host:3306/database
 *   -Dqpx.mysql.user=user
 *   -Dqpx.mysql.password=password
 *
 * Environment variables QPX_MYSQL_URL, QPX_MYSQL_USER and QPX_MYSQL_PASSWORD
 * are accepted as an alternative.
 */
public class DBMetaDataMySQLTest {
    private static final String TABLE = "qpx_metadata_mysql_test";

    public static void main(String[] args) throws Exception {
        String url = value("qpx.mysql.url", "QPX_MYSQL_URL");
        String user = value("qpx.mysql.user", "QPX_MYSQL_USER");
        String password = value("qpx.mysql.password", "QPX_MYSQL_PASSWORD");

        if (url == null || url.isBlank()) {
            throw new IllegalStateException(
                    "MySQL test requires qpx.mysql.url or QPX_MYSQL_URL, e.g. jdbc:mysql://localhost:3306/test");
        }
        if (user == null) user = "";
        if (password == null) password = "";

        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            drop(connection);

            try (Statement s = connection.createStatement()) {
                s.execute("""
                    CREATE TABLE qpx_metadata_mysql_test (
                        ID BIGINT NOT NULL AUTO_INCREMENT,
                        NAME VARCHAR(20) COLLATE utf8mb4_czech_ci NOT NULL,
                        PRICE DECIMAL(12,2) NOT NULL,
                        ACTIVE TINYINT(1) NOT NULL,
                        CREATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UPDATED_AT DATETIME NOT NULL
                            DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (ID),
                        KEY IX_QPX_METADATA_MYSQL_NAME (NAME)
                    )
                    ENGINE=InnoDB
                    DEFAULT CHARSET=utf8mb4
                    COLLATE=utf8mb4_czech_ci
                    COMMENT='QPX MySQL metadata test'
                    """);
            }

            DBMetaData db = DBMetaData.load(connection);
            TableMetaData table = db.table(TABLE);
            check(table != null, "table must be discovered by DBMetaData.load()");
            check(table.database != null && !table.database.isBlank(),
                    "MySQL catalog/database must be discovered");
            check("InnoDB".equalsIgnoreCase(String.valueOf(table.actualParams.get("ENGINE"))),
                    "ENGINE must be loaded from INFORMATION_SCHEMA.TABLES");
            check("utf8mb4".equalsIgnoreCase(String.valueOf(table.actualParams.get("DEFAULT CHARSET"))),
                    "DEFAULT CHARSET must be loaded");
            check("utf8mb4_czech_ci".equalsIgnoreCase(String.valueOf(table.actualParams.get("COLLATE"))),
                    "table COLLATE must be loaded");
            check(String.valueOf(table.actualParams.get("COMMENT")).contains("QPX MySQL metadata test"),
                    "table COMMENT must be loaded");

            TableMetaData targeted = DBMetaData.loadTable(connection, TABLE);
            check(targeted != null, "targeted MySQL metadata must be loaded");
            check(targeted.name.equalsIgnoreCase(TABLE), "targeted table name must be preserved");

            ColumnMetaData id = table.column("ID");
            ColumnMetaData name = table.column("NAME");
            ColumnMetaData price = table.column("PRICE");
            ColumnMetaData active = table.column("ACTIVE");
            ColumnMetaData created = table.column("CREATED_AT");
            ColumnMetaData updated = table.column("UPDATED_AT");

            check(id != null && id.logicalType == ColumnType.LONG, "BIGINT must map to LONG");
            check(id.primaryKey && id.primaryKeyPosition == 1, "ID must be the primary key");
            check(id.autoIncrement, "ID must be AUTO_INCREMENT");
            check(name != null && name.logicalType == ColumnType.STRING && name.length == 20,
                    "NAME must map to STRING(20)");
            check("utf8mb4_czech_ci".equalsIgnoreCase(name.collation),
                    "column collation must be loaded");
            check(!name.nullable, "NAME must be NOT NULL");
            check(price != null && price.logicalType == ColumnType.DECIMAL
                    && price.precision == 12 && price.scale == 2,
                    "PRICE must map to DECIMAL(12,2)");
            check(active != null && active.logicalType == ColumnType.BOOLEAN,
                    "MySQL TINYINT(1) must map to BOOLEAN");
            check(created != null && created.logicalType == ColumnType.DATETIME
                    && created.generation == ColumnGeneration.INSERT_TIMESTAMP,
                    "CREATED_AT must map to INSERT_TIMESTAMP");
            check(updated != null && updated.logicalType == ColumnType.DATETIME
                    && updated.generation == ColumnGeneration.INSERT_UPDATE_TIMESTAMP,
                    "UPDATED_AT must map to INSERT_UPDATE_TIMESTAMP");

            IndexMetaData index = table.index("IX_QPX_METADATA_MYSQL_NAME");
            check(index != null, "secondary index must be discovered");
            check(!index.unique, "secondary index must not be unique");
            check(index.columns.size() == 1
                    && "NAME".equalsIgnoreCase(index.columns.get(0)),
                    "secondary index column must be NAME");
            check("BTREE".equalsIgnoreCase(index.method),
                    "MySQL index method must be loaded");

            DBMetaData desired = new DBMetaData();
            TableMetaData wanted = new TableMetaData(TABLE)
                    .database(table.database)
                    .param("ENGINE", "InnoDB")
                    .param("DEFAULT CHARSET", "utf8mb4")
                    .param("COLLATE", "utf8mb4_czech_ci")
                    .param("COMMENT", "'QPX MySQL metadata test'");

            wanted.addColumn(column("ID", ColumnType.LONG, 0, 0, 0, false, true, true, ColumnGeneration.NONE));
            wanted.addColumn(column("NAME", ColumnType.STRING, 20, 20, 0, false, false, false, ColumnGeneration.NONE)
                    .collation("utf8mb4_czech_ci"));
            wanted.addColumn(column("PRICE", ColumnType.DECIMAL, 0, 12, 2, false, false, false, ColumnGeneration.NONE));
            wanted.addColumn(column("ACTIVE", ColumnType.BOOLEAN, 0, 0, 0, false, false, false, ColumnGeneration.NONE));
            wanted.addColumn(column("CREATED_AT", ColumnType.DATETIME, 0, 0, 0, false, false, false,
                    ColumnGeneration.INSERT_TIMESTAMP));
            wanted.addColumn(column("UPDATED_AT", ColumnType.DATETIME, 0, 0, 0, false, false, false,
                    ColumnGeneration.INSERT_UPDATE_TIMESTAMP));
            wanted.addIndex(new IndexMetaData("IX_QPX_METADATA_MYSQL_NAME")
                    .unique(false).column("NAME").method("BTREE"));
            desired.add(wanted);

            SchemaDiff diff = SchemaDiff.compare(db, desired);
            check(diff.isEmpty(), "normalized MySQL metadata must produce an empty diff: "
                    + diff.toSQL(new MySQLDialect()));

            // Exercise the executable schema path as well: create a fresh table
            // from portable metadata, reload it from MySQL, and require an empty
            // diff afterwards.
            drop(connection);
            DBMetaData empty = DBMetaData.load(connection);
            SchemaDiff createPlan = SchemaDiff.compare(empty, desired);
            check(!createPlan.isEmpty(), "empty MySQL database must require table creation");
            createPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterCreate = DBMetaData.load(connection);
            SchemaDiff verifyCreate = SchemaDiff.compare(afterCreate, desired);
            check(verifyCreate.isEmpty(), "created MySQL schema must converge to desired metadata: "
                    + verifyCreate.toSQL(new MySQLDialect()));

            // Then exercise a real ALTER COLUMN migration.
            ColumnMetaData wantedName = wanted.column("NAME");
            wantedName.length = 40;
            SchemaDiff alterPlan = SchemaDiff.compare(afterCreate, desired);
            check(!alterPlan.isEmpty(), "changing NAME length must produce ALTER_COLUMN");
            check(alterPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ALTER_COLUMN),
                    "changing NAME length must produce ALTER_COLUMN");
            alterPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterAlter = DBMetaData.load(connection);
            check(afterAlter.table(TABLE).column("NAME").length == 40,
                    "ALTER_COLUMN must change NAME length in MySQL");
            wantedName.length = 20;
            SchemaDiff restorePlan = SchemaDiff.compare(afterAlter, desired);
            check(!restorePlan.isEmpty(), "restoring NAME length must produce ALTER_COLUMN");
            restorePlan.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData finalMetadata = DBMetaData.load(connection);
            check(SchemaDiff.compare(finalMetadata, desired).isEmpty(),
                    "MySQL schema must converge after ALTER_COLUMN round-trip");

            // Exercise NULL/NOT NULL and DEFAULT alterations on an existing column.\n            wantedName.nullable = true;\n            wantedName.defaultValue = "'x'";\n            SchemaDiff nullDefaultPlan = SchemaDiff.compare(finalMetadata, desired);\n            check(nullDefaultPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ALTER_COLUMN),\n                    "changing NAME nullability/default must produce ALTER_COLUMN");\n            nullDefaultPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));\n\n            DBMetaData afterNullDefault = DBMetaData.load(connection);\n            ColumnMetaData alteredName = afterNullDefault.table(TABLE).column("NAME");\n            check(alteredName.nullable, "ALTER_COLUMN must make NAME nullable");\n            check(alteredName.defaultValue != null && alteredName.defaultValue.toLowerCase(Locale.ROOT).contains("x"),\n                    "ALTER_COLUMN must add NAME default");\n\n            // AUTO_INCREMENT is part of the column definition and must be diffed exactly.\n            ColumnMetaData wantedId = wanted.column("ID");\n            wantedId.autoIncrement = false;\n            SchemaDiff noAutoIncrementPlan = SchemaDiff.compare(afterNullDefault, desired);\n            check(noAutoIncrementPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ALTER_COLUMN),\n                    "removing AUTO_INCREMENT must produce ALTER_COLUMN");\n            noAutoIncrementPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));\n            DBMetaData afterNoAutoIncrement = DBMetaData.load(connection);\n            check(!afterNoAutoIncrement.table(TABLE).column("ID").autoIncrement,\n                    "ALTER_COLUMN must remove AUTO_INCREMENT");\n\n            // Restore the portable definition before the final convergence check.\n            wantedId.autoIncrement = true;\n            wantedName.nullable = false;\n            wantedName.defaultValue = null;\n            wantedName.length = 20;\n            SchemaDiff restoreDefinition = SchemaDiff.compare(afterNoAutoIncrement, desired);\n            check(restoreDefinition.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ALTER_COLUMN),\n                    "restoring column definition must produce ALTER_COLUMN");\n            restoreDefinition.apply(connection, new DBSchemaManager(new MySQLDialect()));\n\n            DBMetaData restoredMetadata = DBMetaData.load(connection);\n            check(SchemaDiff.compare(restoredMetadata, desired).isEmpty(),\n                    "MySQL schema must converge after column-definition round-trip");\n\n            // Table options are executable migration state as well.\n            wanted.param("COMMENT", "'QPX MySQL metadata migration'");\n            SchemaDiff paramsPlan = SchemaDiff.compare(restoredMetadata, desired);\n            check(paramsPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ALTER_TABLE_PARAMS),\n                    "changing table COMMENT must produce ALTER_TABLE_PARAMS");\n            paramsPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));\n            DBMetaData afterParams = DBMetaData.load(connection);\n            check(String.valueOf(afterParams.table(TABLE).actualParams.get("COMMENT")).contains("migration"),\n                    "ALTER_TABLE_PARAMS must change table COMMENT");\n\n            wanted.param("COMMENT", "'QPX MySQL metadata test'");\n            SchemaDiff restoreParams = SchemaDiff.compare(afterParams, desired);\n            check(!restoreParams.isEmpty(), "restoring table COMMENT must produce a migration");\n            restoreParams.apply(connection, new DBSchemaManager(new MySQLDialect()));\n            check(SchemaDiff.compare(DBMetaData.load(connection), desired).isEmpty(),\n                    "MySQL schema must converge after table-options round-trip");\n\n            // Exercise ADD_COLUMN and DROP_COLUMN as a complete round-trip.
            ColumnMetaData note = column("NOTE", ColumnType.STRING, 64, 64, 0, true, false, false,
                    ColumnGeneration.NONE);
            wanted.addColumn(note);
            SchemaDiff addColumnPlan = SchemaDiff.compare(DBMetaData.load(connection), desired);
            check(addColumnPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.ADD_COLUMN),
                    "adding NOTE must produce ADD_COLUMN");
            addColumnPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterAddColumn = DBMetaData.load(connection);
            check(afterAddColumn.table(TABLE).column("NOTE") != null,
                    "ADD_COLUMN must create NOTE");

            wanted.columns.remove(note);
            SchemaDiff dropColumnPlan = SchemaDiff.compare(afterAddColumn, desired, true);
            check(dropColumnPlan.changes().stream().anyMatch(change -> change.type() == SchemaChange.Type.DROP_COLUMN),
                    "removing NOTE from desired metadata must produce DROP_COLUMN");
            dropColumnPlan.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterDropColumn = DBMetaData.load(connection);
            check(afterDropColumn.table(TABLE).column("NOTE") == null,
                    "DROP_COLUMN must remove NOTE");
            check(SchemaDiff.compare(afterDropColumn, desired).isEmpty(),
                    "MySQL schema must converge after ADD_COLUMN/DROP_COLUMN round-trip");

            System.out.println("DBMetaDataMySQLTest: OK");
            drop(connection);

            migrateJpaMetadata(connection);
        }
    }

    /**
     * Exercises the complete JPA -> desired metadata -> SchemaDiff -> DDL ->
     * JDBC metadata round-trip against the real MySQL database.
     */
    private static void migrateJpaMetadata(Connection connection) throws Exception {
        final String tableName = "qpx_jpa_mysql_test";
        try (EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test")) {
            JpaMetaDataReader reader = new JpaMetaDataReader();

            var entityV1 = emf.getMetamodel().entity(JpaMetaDataReaderTest.StringIdEntity.class);
            TableMetaData wantedV1 = reader.readTable(entityV1);
            wantedV1.name(tableName);
            DBMetaData desiredV1 = new DBMetaData().add(wantedV1);

            DBMetaData actual = DBMetaData.load(connection);
            SchemaDiff initial = SchemaDiff.compare(actual, desiredV1);

            check(initial.changes().stream().anyMatch(c -> c.type() == SchemaChange.Type.CREATE_TABLE),
                    "JPA metadata must produce CREATE_TABLE for a missing MySQL table");
            initial.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterCreate = DBMetaData.load(connection);
            TableMetaData actualTable = afterCreate.table(tableName);
            check(actualTable != null, "JPA-derived table must exist after migration");
            check(actualTable.column("id") != null, "JPA-derived id column must exist");
            check(actualTable.column("id").logicalType == ColumnType.STRING,
                    "JPA-derived id must remain STRING");
            check(actualTable.column("id").length == 20,
                    "JPA @Column(length=20) must become VARCHAR(20)");
            check(SchemaDiff.compare(afterCreate, desiredV1).isEmpty(),
                    "JPA-derived MySQL schema must converge after CREATE_TABLE");

            // Read a second JPA model version and migrate the existing table.
            // V2 changes NAME from VARCHAR(20) NOT NULL to VARCHAR(40) NULL
            // and adds NOTE VARCHAR(64) NULL.
            var entityV2 = emf.getMetamodel().entity(JpaMetaDataReaderTest.StringIdEntityV2.class);
            TableMetaData wantedV2 = reader.readTable(entityV2);
            wantedV2.name(tableName);
            DBMetaData desiredV2 = new DBMetaData().add(wantedV2);

            SchemaDiff evolve = SchemaDiff.compare(afterCreate, desiredV2);
            check(evolve.changes().stream().anyMatch(c -> c.type() == SchemaChange.Type.ALTER_COLUMN),
                    "JPA V2 NAME change must produce ALTER_COLUMN");
            check(evolve.changes().stream().anyMatch(c -> c.type() == SchemaChange.Type.ADD_COLUMN),
                    "JPA V2 NOTE addition must produce ADD_COLUMN");
            evolve.apply(connection, new DBSchemaManager(new MySQLDialect()));

            DBMetaData afterEvolution = DBMetaData.load(connection);
            TableMetaData evolved = afterEvolution.table(tableName);
            check(evolved.column("name") != null, "JPA V2 NAME column must exist");
            check(evolved.column("name").length == 40,
                    "JPA V2 @Column(length=40) must become VARCHAR(40)");
            check(evolved.column("name").nullable,
                    "JPA V2 nullable=true must make NAME nullable");
            check(evolved.column("note") != null, "JPA V2 NOTE column must be added");
            check(evolved.column("note").length == 64,
                    "JPA V2 @Column(length=64) must become VARCHAR(64)");
            check(evolved.column("note").nullable,
                    "JPA V2 NOTE must be nullable");
            check(SchemaDiff.compare(afterEvolution, desiredV2).isEmpty(),
                    "JPA V2 MySQL schema must converge after ALTER/ADD migration");

            dropTable(connection, tableName);
        }
    }

    private static void dropTable(Connection connection, String tableName) throws Exception {
        try (Statement s = connection.createStatement()) {
            s.executeUpdate("DROP TABLE IF EXISTS " + tableName);
        }
    }

    private static ColumnMetaData column(String name, ColumnType type, int length, int precision,
            int scale, boolean nullable, boolean primaryKey, boolean autoIncrement,
            ColumnGeneration generation) {
        ColumnMetaData c = new ColumnMetaData(name);
        c.logicalType = type;
        c.length = length;
        c.precision = precision;
        c.scale = scale;
        c.nullable = nullable;
        c.primaryKey = primaryKey;
        c.autoIncrement = autoIncrement;
        c.generation = generation;
        return c;
    }

    private static void drop(Connection connection) throws Exception {
        try (Statement s = connection.createStatement()) {
            s.execute("DROP TABLE IF EXISTS " + TABLE);
        }
    }

    private static String value(String property, String environment) {
        String value = System.getProperty(property);
        if (value != null && !value.isBlank()) return value;
        value = System.getenv(environment);
        return value != null && !value.isBlank() ? value : null;
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
