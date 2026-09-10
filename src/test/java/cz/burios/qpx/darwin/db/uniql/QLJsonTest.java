package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import java.util.List;

/** Executable tests for JSON serialization/deserialization of the SELECT AST. */
public class QLJsonTest {
    public static void main(String[] args) throws Exception {
        roundTripsComplexSelect();
        roundTripsCrudStatements();
        rendersSqlDirectlyFromJson();
        System.out.println("QLJsonTest: OK");
    }

    static void roundTripsComplexSelect() throws Exception {
        QLSelect totals = select(
                col("customer_id"),
                fn("SUM", col("amount")).as("total"))
                .from("orders")
                .groupBy(col("customer_id"))
                .build();

        QLSelect original = select(
                col("c.id"),
                fn("COUNT", col("o.id")).distinct().as("order_count"),
                fn("COALESCE", col("t.total"), val(0)).as("total"),
                caseExpr()
                        .when(col("c.active").eq(true), "yes")
                        .elseValue("no")
                        .as("active_label"))
                .from(table("customers").as("c"))
                .leftJoin(subSelect(totals).as("t"), col("t.customer_id").eq(col("c.id")))
                .leftJoin(table("orders").as("o"), col("o.customer_id").eq(col("c.id")))
                .where(col("c.id").in(1, 2, 3)
                        .and(col("c.deleted_at").isNull()))
                .groupBy(col("c.id"), col("t.total"))
                .having(fn("COUNT", col("o.id")).gt(0))
                .orderByDesc(fn("COUNT", col("o.id")))
                .limit(20)
                .offset(10)
                .build();

        String json = QLJson.toJson(original);
        QLSelect restored = QLJson.fromJson(json);

        QLSql.Result expected = QLSql.render(original);
        QLSql.Result actual = QLSql.render(restored);

        assertEquals(expected.sql(), actual.sql());
        assertEquals(expected.parameters(), actual.parameters());
    }

    static void roundTripsCrudStatements() throws Exception {
        QLInsert insert = new QLInsert(table("users"))
                .columns("name", "active")
                .values("Alice", true);
        QLUpdate update = new QLUpdate(table("users"))
                .set("active", false)
                .where(col("id").eq(7));
        QLDelete delete = new QLDelete(table("users"))
                .where(col("id").eq(7));

        assertStatementRoundTrip(insert);
        assertStatementRoundTrip(update);
        assertStatementRoundTrip(delete);
    }

    static void rendersSqlDirectlyFromJson() throws Exception {
        QLSelect original = select(col("id"), col("name"))
                .from("users")
                .where(col("active").eq(true))
                .build();

        String json = QLJson.toJson(original);
        QLSql.Result result = QLJson.toSql(json);

        assertEquals("SELECT id, name FROM users WHERE (active = ?)", result.sql());
        assertEquals(List.of(true), result.parameters());
    }

    private static void assertStatementRoundTrip(QLStatement original) throws Exception {
        String json = QLJson.statementToJson(original);
        QLStatement restored = QLJson.statementFromJson(json);

        QLSql.Result expected = QLSql.render(original);
        QLSql.Result actual = QLSql.render(restored);

        assertEquals(expected.sql(), actual.sql());
        assertEquals(expected.parameters(), actual.parameters());
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }
}
