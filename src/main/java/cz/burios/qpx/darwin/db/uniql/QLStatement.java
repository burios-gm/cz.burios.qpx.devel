package cz.burios.qpx.darwin.db.uniql;

/** Base type for executable SQL statements. */
public abstract class QLStatement {
    public abstract void accept(QLVisitor visitor);
}
