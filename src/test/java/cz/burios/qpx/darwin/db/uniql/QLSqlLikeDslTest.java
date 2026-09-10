package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

/** Executable smoke tests for the SQL-like fluent DSL; no JUnit required. */
public final class QLSqlLikeDslTest {
    public static void main(String[] args) {
        qualifiedAliasesAndJoin();
        subSelectFrom();
        System.out.println("QLSqlLikeDslTest: OK");
    }

    private static void qualifiedAliasesAndJoin() {
        QLSql.Result r = select(
                col("s.NAME", "storeName"),
                fn("COUNT", col("o.ID")).as("orders")
        ).from(table("depo_cz.store").as("s"))
         .leftJoin(table("depo_cz.orders").as("o"), col("o.STORE_ID").eq(col("s.ID")))
         .groupBy(col("s.NAME"))
         .orderByDesc(col("s.NAME"))
         .limit(10)
         .sql();

        String expected = "SELECT s.NAME AS storeName, COUNT(o.ID) AS orders FROM depo_cz.store AS s "
                + "LEFT JOIN depo_cz.orders AS o ON (o.STORE_ID = s.ID) "
                + "GROUP BY s.NAME ORDER BY s.NAME DESC LIMIT 10";
        assert expected.equals(r.sql()) : r.sql();
    }

    private static void subSelectFrom() {
        QLSelect inner = select(col("ID"), col("NAME"))
                .from(schema("depo_sk", "store"))
                .where(col("ACTIVE").eq(true))
                .build();

        QLSql.Result r = select(col("x.NAME"))
                .from(inner, "x")
                .where(col("x.ID").gt(100))
                .sql();

        String expected = "SELECT x.NAME FROM (SELECT ID, NAME FROM depo_sk.store WHERE (ACTIVE = ?)) AS x WHERE (x.ID > ?)";
        assert expected.equals(r.sql()) : r.sql();
        assert r.parameters().size() == 2;
        assert Boolean.TRUE.equals(r.parameters().get(0));
        assert Integer.valueOf(100).equals(r.parameters().get(1));
    }
}
