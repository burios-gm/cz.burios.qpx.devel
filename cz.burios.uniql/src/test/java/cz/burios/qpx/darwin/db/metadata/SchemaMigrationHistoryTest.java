package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.*;

/** Executable integration test for persistent migration history. */
public final class SchemaMigrationHistoryTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_history;DB_CLOSE_DELAY=-1")) {
            SchemaMigrationHistory history = new SchemaMigrationHistory();
            history.ensureTable(connection);
            history.ensureTable(connection);

            DBSchemaMigrator migrator = new DBSchemaMigrator(new H2Dialect());
            DBMetaData desired = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT")));
            SchemaDiff plan = migrator.plan(connection, desired);
            String hash = plan.planHash();
            if (hash.length() != 64) throw new AssertionError("Invalid plan hash: " + hash);

            history.start(connection, "V1", hash);
            if (history.find(connection, "V1").status() != SchemaMigrationHistory.Status.RUNNING)
                throw new AssertionError("Expected RUNNING history entry");
            history.markApplied(connection, "V1");
            if (history.find(connection, "V1").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Expected APPLIED history entry");

            try {
                history.start(connection, "v1", hash);
                throw new AssertionError("Case-insensitive duplicate migration ID should fail");
            } catch (SchemaMigrationException expected) { }

            SchemaMigrationHistory.Entry stored = history.find(connection, "v1");
            if (!"v1".equalsIgnoreCase(stored.migrationId()))
                throw new AssertionError("Migration lookup must remain case-insensitive: " + stored);

            history.start(connection, "V2", hash);
            history.markFailed(connection, "V2", "test failure");
            SchemaMigrationHistory.Entry failed = history.find(connection, "V2");
            if (failed.status() != SchemaMigrationHistory.Status.FAILED || !"test failure".equals(failed.errorMessage()))
                throw new AssertionError("Expected FAILED history entry: " + failed);
            if (history.list(connection).size() != 2) throw new AssertionError("Expected two history entries");
        }

        verifyHistoryUsesCurrentSchema();
        verifyConcurrentDuplicateIsRejected();
        verifyConcurrentEnsureTableIsSafe();
        System.out.println("SchemaMigrationHistoryTest: OK");
    }

    private static void verifyHistoryUsesCurrentSchema() throws Exception {
        String url = "jdbc:h2:mem:migration_history_schema;DB_CLOSE_DELAY=-1;INIT=CREATE SCHEMA IF NOT EXISTS APP;SCHEMA=APP";
        try (Connection connection = DriverManager.getConnection(url)) {
            SchemaMigrationHistory history = new SchemaMigrationHistory();
            history.ensureTable(connection);
            if (history.list(connection).size() != 0)
                throw new AssertionError("Fresh schema history must be empty");

            try (var statement = connection.createStatement();
                 var rs = statement.executeQuery(
                         "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                       + "WHERE TABLE_SCHEMA = 'APP' AND TABLE_NAME = 'QPX_SCHEMA_MIGRATION'")) {
                if (!rs.next() || rs.getInt(1) != 1)
                    throw new AssertionError("Migration history table must be created in the current schema");
            }

            history.start(connection, "SCHEMA-CHECK",
                    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
            if (history.find(connection, "SCHEMA-CHECK") == null)
                throw new AssertionError("Qualified migration history table must be usable");
        }
    }

    private static void verifyConcurrentDuplicateIsRejected() throws Exception {
        String url = "jdbc:h2:mem:migration_history_concurrent;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
        try (Connection setup = DriverManager.getConnection(url)) {
            new SchemaMigrationHistory().ensureTable(setup);
        }

        try (Connection first = DriverManager.getConnection(url);
             Connection second = DriverManager.getConnection(url)) {
            SchemaMigrationHistory firstHistory = new SchemaMigrationHistory();
            SchemaMigrationHistory secondHistory = new SchemaMigrationHistory();
            String hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch go = new CountDownLatch(1);
            AtomicInteger successes = new AtomicInteger();
            AtomicInteger duplicates = new AtomicInteger();
            Throwable[] failures = new Throwable[2];

            Thread firstThread = new Thread(() -> runConcurrentStart(firstHistory, first, hash, ready, go, successes, duplicates, failures, 0), "migration-history-first");
            Thread secondThread = new Thread(() -> runConcurrentStart(secondHistory, second, hash, ready, go, successes, duplicates, failures, 1), "migration-history-second");
            firstThread.start();
            secondThread.start();
            ready.await();
            go.countDown();
            firstThread.join(10000);
            secondThread.join(10000);

            if (firstThread.isAlive() || secondThread.isAlive())
                throw new AssertionError("Concurrent migration history starts did not finish");
            if (failures[0] != null) throw new AssertionError("First concurrent start failed unexpectedly", failures[0]);
            if (failures[1] != null) throw new AssertionError("Second concurrent start failed unexpectedly", failures[1]);
            if (successes.get() != 1 || duplicates.get() != 1)
                throw new AssertionError("Expected exactly one successful start and one duplicate: successes="
                        + successes + ", duplicates=" + duplicates);
            if (new SchemaMigrationHistory().list(first).size() != 1)
                throw new AssertionError("Concurrent starts must leave exactly one history row");
        }
    }

    private static void verifyConcurrentEnsureTableIsSafe() throws Exception {
        String url = "jdbc:h2:mem:migration_history_bootstrap;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
        try (Connection first = DriverManager.getConnection(url);
             Connection second = DriverManager.getConnection(url)) {
            SchemaMigrationHistory firstHistory = new SchemaMigrationHistory();
            SchemaMigrationHistory secondHistory = new SchemaMigrationHistory();
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch go = new CountDownLatch(1);
            Throwable[] failures = new Throwable[2];

            Thread firstThread = new Thread(() -> runConcurrentEnsureTable(firstHistory, first, ready, go, failures, 0),
                    "migration-history-bootstrap-first");
            Thread secondThread = new Thread(() -> runConcurrentEnsureTable(secondHistory, second, ready, go, failures, 1),
                    "migration-history-bootstrap-second");
            firstThread.start();
            secondThread.start();
            ready.await();
            go.countDown();
            firstThread.join(10000);
            secondThread.join(10000);

            if (firstThread.isAlive() || secondThread.isAlive())
                throw new AssertionError("Concurrent ensureTable calls did not finish");
            if (failures[0] != null) throw new AssertionError("First concurrent ensureTable failed", failures[0]);
            if (failures[1] != null) throw new AssertionError("Second concurrent ensureTable failed", failures[1]);

            try (Connection verify = DriverManager.getConnection(url)) {
                SchemaMigrationHistory history = new SchemaMigrationHistory();
                history.ensureTable(verify);
                if (!history.list(verify).isEmpty())
                    throw new AssertionError("Fresh concurrent history bootstrap must not create migration rows");
                history.start(verify, "BOOTSTRAP-CHECK",
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
                SchemaMigrationHistory.Entry entry = history.find(verify, "BOOTSTRAP-CHECK");
                if (entry == null || entry.status() != SchemaMigrationHistory.Status.RUNNING)
                    throw new AssertionError("History table is not usable after concurrent bootstrap");
                if (entry.definitionHash() != null)
                    throw new AssertionError("Legacy start() should leave definition hash null");
            }
        }
    }

    private static void runConcurrentEnsureTable(SchemaMigrationHistory history, Connection connection,
            CountDownLatch ready, CountDownLatch go, Throwable[] failures, int failureIndex) {
        try {
            ready.countDown();
            go.await();
            history.ensureTable(connection);
        } catch (Throwable failure) {
            failures[failureIndex] = failure;
        }
    }

    private static void runConcurrentStart(SchemaMigrationHistory history, Connection connection, String hash,
            CountDownLatch ready, CountDownLatch go, AtomicInteger successes, AtomicInteger duplicates,
            Throwable[] failures, int failureIndex) {
        try {
            ready.countDown();
            go.await();
            history.start(connection, "V-CONCURRENT", hash);
            successes.incrementAndGet();
        } catch (SchemaMigrationException expected) {
            duplicates.incrementAndGet();
        } catch (Throwable failure) {
            failures[failureIndex] = failure;
        }
    }
}
