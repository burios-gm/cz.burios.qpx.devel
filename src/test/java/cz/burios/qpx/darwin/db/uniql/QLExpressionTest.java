package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import java.util.List;

/** Executable tests for SQL predicates and logical expressions. */
public class QLExpressionTest {
    public static void main(String[] args) {
        rendersInAndNotIn();
        rendersInSubselect();
        rendersBetweenAndNullPredicates();
        rendersNestedAndOrNot();
        rendersExistsAndNotExists();
        rejectsEmptyIn();
        System.out.println("QLExpressionTest: OK");
    }

    static void rendersInAndNotIn() {
        QLSql.Result result = select(col("id"))
                .from("users")
                .where(col("status").in("ACTIVE", "PENDING"))
                .sql();

        assertEquals("SELECT id FROM users WHERE (status IN (?, ?))", result.sql());
        assertEquals(List.of("ACTIVE", "PENDING"), result.parameters());

        result = select(col("id"))
                .from("users")
                .where(col("status").in("DELETED", "BLOCKED").not())
                .sql();

        assertEquals("SELECT id FROM users WHERE (status NOT IN (?, ?))", result.sql());
        assertEquals(List.of("DELETED", "BLOCKED"), result.parameters());
    }

    static void rendersInSubselect() {
        QLSelect sub = select(col("user_id"))
                .from("orders")
                .where(col("total").gt(1000))
                .build();

        QLSql.Result result = select(col("id"))
                .from("users")
                .where(col("id").in().select(sub))
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (id IN (SELECT user_id FROM orders WHERE (total > ?)))",
                result.sql());
        assertEquals(List.of(1000), result.parameters());
    }

    static void rendersBetweenAndNullPredicates() {
        QLSql.Result result = select(col("id"))
                .from("users")
                .where(col("age").between(18, 65))
                .and(col("deleted_at").isNull())
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (age BETWEEN ? AND ?) AND (deleted_at IS NULL)",
                result.sql());
        assertEquals(List.of(18, 65), result.parameters());

        result = select(col("id"))
                .from("users")
                .where(col("age").between(18, 65).not())
                .and(col("deleted_at").isNotNull())
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (age NOT BETWEEN ? AND ?) AND (deleted_at IS NOT NULL)",
                result.sql());
        assertEquals(List.of(18, 65), result.parameters());
    }

    static void rendersNestedAndOrNot() {
        QLExpr active = col("active").eq(true);
        QLExpr premium = col("plan").eq("PREMIUM");
        QLExpr trial = col("trial").eq(true);

        QLSql.Result result = select(col("id"))
                .from("users")
                .where(active.and(premium.or(trial)).not())
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (NOT ((active = ?) AND ((plan = ?) OR (trial = ?))))",
                result.sql());
        assertEquals(List.of(true, "PREMIUM", true), result.parameters());
    }

    static void rendersExistsAndNotExists() {
        QLSelect sub = select(col("id"))
                .from("orders")
                .where(col("orders.user_id").eq(col("users.id")))
                .build();

        QLSql.Result result = select(col("id"))
                .from(table("users"))
                .where(exists(sub))
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (EXISTS (SELECT id FROM orders WHERE (orders.user_id = users.id)))",
                result.sql());
        assertEquals(List.of(), result.parameters());

        result = select(col("id"))
                .from("users")
                .where(exists(sub).not())
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (NOT EXISTS (SELECT id FROM orders WHERE (orders.user_id = users.id)))",
                result.sql());
        assertEquals(List.of(), result.parameters());
    }

    static void rejectsEmptyIn() {
        assertThrows(IllegalStateException.class, () ->
                select(col("id")).from("users").where(col("id").in()).sql());
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }

    private static void assertThrows(Class<? extends Throwable> type, Runnable action) {
        try {
            action.run();
        } catch (Throwable t) {
            if (type.isInstance(t)) return;
            throw new AssertionError("Expected " + type.getName() + " but was " + t.getClass().getName(), t);
        }
        throw new AssertionError("Expected " + type.getName() + " to be thrown");
    }
}
