package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import java.util.List;

/** Executable tests for complex SELECT sources, joins, functions and CASE. */
public class QLComplexSelectTest {
    public static void main(String[] args) {
        rendersSubselectAsFromSource();
        rendersSubselectAsJoinSource();
        rendersFunctionWithAliasAndDistinct();
        rendersSearchedCaseWithAlias();
        rendersComplexCombination();
        System.out.println("QLComplexSelectTest: OK");
    }

    static void rendersSubselectAsFromSource() {
        QLSelect sub = select(col("user_id"), fn("SUM", col("amount")).as("total"))
                .from("orders")
                .groupBy(col("user_id"))
                .build();

        QLSql.Result result = select(col("x.user_id"), col("x.total"))
                .from(subSelect(sub).as("x"))
                .where(col("x.total").gt(1000))
                .sql();

        assertEquals(
                "SELECT x.user_id, x.total FROM (SELECT user_id, SUM(amount) AS total FROM orders GROUP BY user_id) AS x "
                        + "WHERE (x.total > ?)",
                result.sql());
        assertEquals(List.of(1000), result.parameters());
    }

    static void rendersSubselectAsJoinSource() {
        QLSelect sub = select(col("user_id"), fn("COUNT", col("id")).as("cnt"))
                .from("orders")
                .groupBy(col("user_id"))
                .build();

        QLSql.Result result = select(col("u.id"), col("o.cnt"))
                .from(table("users").as("u"))
                .leftJoin(subSelect(sub).as("o"), col("o.user_id").eq(col("u.id")))
                .sql();

        assertEquals(
                "SELECT u.id, o.cnt FROM users AS u LEFT JOIN "
                        + "(SELECT user_id, COUNT(id) AS cnt FROM orders GROUP BY user_id) AS o "
                        + "ON (o.user_id = u.id)",
                result.sql());
        assertEquals(List.of(), result.parameters());
    }

    static void rendersFunctionWithAliasAndDistinct() {
        QLSql.Result result = select(
                fn("COUNT", col("id")).as("count_all"),
                fn("COUNT", col("email")).distinct().as("count_emails"))
                .from("users")
                .sql();

        assertEquals(
                "SELECT COUNT(id) AS count_all, COUNT(DISTINCT email) AS count_emails FROM users",
                result.sql());
        assertEquals(List.of(), result.parameters());
    }

    static void rendersSearchedCaseWithAlias() {
        QLSql.Result result = select(
                caseExpr()
                        .when(col("status").eq("A"), "active")
                        .when(col("status").eq("B"), "blocked")
                        .elseValue("other")
                        .as("status_label"))
                .from("users")
                .sql();

        assertEquals(
                "SELECT CASE WHEN (status = ?) THEN ? WHEN (status = ?) THEN ? ELSE ? END AS status_label FROM users",
                result.sql());
        assertEquals(List.of("A", "active", "B", "blocked", "other"), result.parameters());
    }

    static void rendersComplexCombination() {
        QLSelect totals = select(
                col("customer_id"),
                fn("SUM", col("amount")).as("total"))
                .from("orders")
                .groupBy(col("customer_id"))
                .build();

        QLSql.Result result = select(
                col("c.id"),
                col("c.name"),
                fn("COALESCE", col("t.total"), val(0)).as("total"),
                caseExpr().when(col("c.active").eq(true), "yes").elseValue("no").as("active_label"))
                .from(table("customers").as("c"))
                .leftJoin(subSelect(totals).as("t"), col("t.customer_id").eq(col("c.id")))
                .where(col("c.deleted_at").isNull().and(col("c.id").in(1, 2, 3)))
                .orderByDesc(fn("COALESCE", col("t.total"), val(0)))
                .limit(10)
                .sql();

        assertEquals(
                "SELECT c.id, c.name, COALESCE(t.total, ?) AS total, "
                        + "CASE WHEN (c.active = ?) THEN ? ELSE ? END AS active_label "
                        + "FROM customers AS c LEFT JOIN "
                        + "(SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id) AS t "
                        + "ON (t.customer_id = c.id) "
                        + "WHERE ((c.deleted_at IS NULL) AND (c.id IN (?, ?, ?))) "
                        + "ORDER BY COALESCE(t.total, ?) DESC LIMIT 10",
                result.sql());
        assertEquals(List.of(0, true, "yes", "no", 1, 2, 3, 0), result.parameters());
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }
}
