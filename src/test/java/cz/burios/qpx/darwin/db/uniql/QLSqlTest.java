package cz.burios.qpx.darwin.db.uniql;

import cz.burios.qpx.darwin.db.uniql.dsl.DSL;
import org.junit.jupiter.api.Test;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

class QLSqlTest {
    @Test
    void rendersArithmeticAndParameters() {
        QLSql.Result result = select(col("price").add(col("tax")).mul(1.21).as("total"))
                .from("products")
                .sql();

        assertEquals("SELECT ((price + tax) * ?) AS total FROM products", result.sql());
        assertEquals(java.util.List.of(1.21), result.parameters());
    }

    @Test
    void rendersJoinFunctionGroupHavingOrderAndLimit() {
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

    @Test
    void rendersCaseExistsAndSubselect() {
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

    @Test
    void rendersJsonRoundTrip() throws Exception {
        QLSelect select = DSL.select(col("u.id"))
                .from(table("users").as("u"))
                .where(col("u.active").eq(true))
                .build();

        QLSelect restored = QLJson.fromJson(QLJson.toJson(select));
        QLSql.Result result = QLSql.render(restored);

        assertEquals("SELECT u.id FROM users AS u WHERE (u.active = ?)", result.sql());
        assertEquals(java.util.List.of(true), result.parameters());
    }
}
