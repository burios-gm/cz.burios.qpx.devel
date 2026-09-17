package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.uniql.sql.dsl.DSL.*;

import cz.burios.uniql.sql.*;

public class QLSqlTest {
    public static void main(String[] args) throws Exception {
        rendersArithmeticAndParameters();
        rendersJoinFunctionGroupHavingOrderAndLimit();
        rendersCaseExistsAndSubselect();
        rendersWhereBooleanComposition();
        rendersInBetweenAndNullPredicates();
        rendersJsonRoundTrip();
        System.out.println("QLSqlTest: OK");
    }

    static void rendersArithmeticAndParameters() {
        QLSql.Result result = select(col("price").add(col("tax")).mul(1.21).as("total"))
                .from("products")
                .sql();

        assertEquals("SELECT ((price + tax) * ?) AS total", result.sql());
        assertEquals(java.util.List.of(1.21), result.parameters());
    }

    static void rendersJoinFunctionGroupHavingOrderAndLimit() {
        QLSql.Result result = select(
                col("o.customer_id"),
                fn("SUM", col("o.amount")).as("total"))
                .from(table("orders").as("o"))
                .leftJoin(table("customers").as("c"), col("c.id").eq(col("o.customer_id")))
                .groupBy(col("o.customer_id"))
                .having(fn("SUM", col("o.amount")).gt(1000))
                .orderByDesc(fn("SUM", col("o.amount")))
                .limit(20)
                .sql();

        assertEquals(
                "SELECT o.customer_id, SUM(o.amount) AS total FROM orders AS o "
                        + "LEFT JOIN customers AS c ON (c.id = o.customer_id) "
                        + "GROUP BY o.customer_id HAVING (SUM(o.amount) > ?) "
                        + "ORDER BY SUM(o.amount) DESC LIMIT 20",
                result.sql());
        assertEquals(java.util.List.of(1000), result.parameters());
    }

    static void rendersCaseExistsAndSubselect() {
        QLSelect sub = select(col("o.id"))
                .from(table("orders").as("o"))
                .where(col("o.user_id").eq(col("u.id")))
                .build();

        QLSql.Result result = select(
                col("u.id"),
                caseExpr()
                        .when(col("u.age").lt(18), "child")
                        .when(col("u.age").lt(65), "adult")
                        .elseValue("senior")
                        .as("age_group"))
                .from(table("users").as("u"))
                .where(exists(sub))
                .sql();

        assertEquals(
                "SELECT u.id, CASE WHEN (u.age < ?) THEN ? WHEN (u.age < ?) THEN ? ELSE ? END AS age_group "
                        + "FROM users AS u WHERE (EXISTS (SELECT o.id FROM orders AS o WHERE (o.user_id = u.id)))",
                result.sql());
        assertEquals(java.util.List.of(18, "child", 65, "adult", "senior"), result.parameters());
    }

    static void rendersWhereBooleanComposition() {
        QLSql.Result result = select("id")
                .from("users")
                .where(col("active").eq(true))
                .or(col("role").eq("admin"))
                .and(col("deleted").eq(false))
                .sql();

        assertEquals(
                "SELECT id FROM users WHERE (((active = ?) OR (role = ?)) AND (deleted = ?))",
                result.sql());
        assertEquals(java.util.List.of(true, "admin", false), result.parameters());
    }

    static void rendersInBetweenAndNullPredicates() {
        QLSql.Result inValues = select("id")
                .from("users")
                .where(col("id").in(1, 2, 3))
                .sql();
        assertEquals("SELECT id FROM users WHERE (id IN (?, ?, ?))", inValues.sql());
        assertEquals(java.util.List.of(1, 2, 3), inValues.parameters());

        QLSql.Result notInValues = select("id")
                .from("users")
                .where(col("id").in(1, 2, 3).not())
                .sql();
        assertEquals("SELECT id FROM users WHERE (id NOT IN (?, ?, ?))", notInValues.sql());
        assertEquals(java.util.List.of(1, 2, 3), notInValues.parameters());

        QLSelect ids = select("id").from("blocked_users").build();
        QLSql.Result inSelect = select("id")
                .from("users")
                .where(col("id").in(ids))
                .sql();
        assertEquals("SELECT id FROM users WHERE (id IN (SELECT id FROM blocked_users))", inSelect.sql());
        assertEquals(java.util.List.of(), inSelect.parameters());

        QLSql.Result notInSelect = select("id")
                .from("users")
                .where(col("id").in(subSelect(ids)).not())
                .sql();
        assertEquals("SELECT id FROM users WHERE (id NOT IN (SELECT id FROM blocked_users))", notInSelect.sql());
        assertEquals(java.util.List.of(), notInSelect.parameters());

        QLSql.Result between = select("id")
                .from("users")
                .where(col("age").between(18, 65))
                .sql();
        assertEquals("SELECT id FROM users WHERE (age BETWEEN ? AND ?)", between.sql());
        assertEquals(java.util.List.of(18, 65), between.parameters());

        QLSql.Result notBetween = select("id")
                .from("users")
                .where(col("age").between(18, 65).not())
                .sql();
        assertEquals("SELECT id FROM users WHERE (age NOT BETWEEN ? AND ?)", notBetween.sql());
        assertEquals(java.util.List.of(18, 65), notBetween.parameters());

        QLSql.Result nulls = select("id")
                .from("users")
                .where(col("deleted_at").isNull())
                .sql();
        assertEquals("SELECT id FROM users WHERE (deleted_at IS NULL)", nulls.sql());
        assertEquals(java.util.List.of(), nulls.parameters());

        QLSql.Result notNulls = select("id")
                .from("users")
                .where(col("deleted_at").isNotNull())
                .sql();
        assertEquals("SELECT id FROM users WHERE (deleted_at IS NOT NULL)", notNulls.sql());
        assertEquals(java.util.List.of(), notNulls.parameters());

        QLSql.Result notExpression = select("id")
                .from("users")
                .where(col("active").eq(true).not())
                .sql();
        assertEquals("SELECT id FROM users WHERE (NOT (active = ?))", notExpression.sql());
        assertEquals(java.util.List.of(true), notExpression.parameters());
    }

    static void rendersJsonRoundTrip() throws Exception {
        QLSelect select = select(col("u.id"))
                .from(table("users").as("u"))
                .where(col("u.active").eq(true))
                .build();

        QLSelect restored = QLJson.fromJson(QLJson.toJson(select));
        QLSql.Result result = QLSql.render(restored);

        assertEquals("SELECT u.id FROM users AS u WHERE (u.active = ?)", result.sql());
        assertEquals(java.util.List.of(true), result.parameters());
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }
}
