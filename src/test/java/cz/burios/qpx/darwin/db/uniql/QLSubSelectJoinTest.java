package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

/** Executable tests for derived tables, subselects and JOIN rendering. */
public final class QLSubSelectJoinTest {
    public static void main(String[] args) {
        derivedTableJoin();
        scalarSubSelect();
        nestedWhereSubSelect();
        System.out.println("QLSubSelectJoinTest: OK");
    }

    private static void derivedTableJoin() {
        QLSelect totals = select(
                col("STORE_ID"),
                fn("SUM", col("AMOUNT")).as("TOTAL")
        ).from(table("depo_cz.sales"))
         .groupBy(col("STORE_ID"))
         .build();

        QLSql.Result r = select(
                col("s.NAME"),
                col("x.TOTAL")
        ).from(table("depo_cz.store").as("s"))
         .join("LEFT", totals, "x", col("x.STORE_ID").eq(col("s.ID")))
         .where(col("s.ACTIVE").eq(true))
         .sql();

        String expected = "SELECT s.NAME, x.TOTAL FROM depo_cz.store AS s LEFT JOIN (SELECT STORE_ID, SUM(AMOUNT) AS TOTAL FROM depo_cz.sales GROUP BY STORE_ID) AS x ON (x.STORE_ID = s.ID) WHERE (s.ACTIVE = ?)";
        assert expected.equals(r.sql()) : r.sql();
        assert r.parameters().size() == 1 && Boolean.TRUE.equals(r.parameters().get(0));
    }

    private static void scalarSubSelect() {
        QLSelect maxPrice = select(fn("MAX", col("PRICE")).as("MAX_PRICE"))
                .from("depo_cz.sales").build();
        QLSql.Result r = select(
                col("NAME"),
                subSelect(maxPrice).as("MAX_PRICE")
        ).from("depo_cz.store").sql();
        String expected = "SELECT NAME, (SELECT MAX(PRICE) AS MAX_PRICE FROM depo_cz.sales) AS MAX_PRICE FROM depo_cz.store";
        assert expected.equals(r.sql()) : r.sql();
    }

    private static void nestedWhereSubSelect() {
        QLSelect ids = select(col("STORE_ID")).from("depo_cz.sales").where(col("AMOUNT").gt(100)).build();
        QLSql.Result r = select(col("ID"), col("NAME"))
                .from("depo_cz.store")
                .where(col("ID").in().select(subSelect(ids)))
                .sql();
        String expected = "SELECT ID, NAME FROM depo_cz.store WHERE (ID IN (SELECT STORE_ID FROM depo_cz.sales WHERE (AMOUNT > ?)))";
        assert expected.equals(r.sql()) : r.sql();
        assert r.parameters().size() == 1 && Integer.valueOf(100).equals(r.parameters().get(0));
    }
}
