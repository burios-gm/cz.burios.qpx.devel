package cz.burios.qpx.darwin.db.uniql;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/** Base type for executable SQL statements. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = QLSelect.class, name = "select"),
    @JsonSubTypes.Type(value = QLInsert.class, name = "insert"),
    @JsonSubTypes.Type(value = QLUpdate.class, name = "update"),
    @JsonSubTypes.Type(value = QLDelete.class, name = "delete")
})
public abstract class QLStatement {
    public abstract void accept(QLVisitor visitor);
}
