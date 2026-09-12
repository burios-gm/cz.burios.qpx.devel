package cz.burios.qpx.darwin.db.metadata;

import java.util.ArrayList;
import java.util.List;

/** Metadata of a non-primary database index. */
public class IndexMetaData {
    public String name;
    public boolean unique;
    public String type;
    public String method;
    public final List<String> columns = new ArrayList<>();

    public IndexMetaData() {}
    public IndexMetaData(String name) { this.name = name; }

    public IndexMetaData name(String value) { this.name = value; return this; }
    public IndexMetaData unique(boolean value) { this.unique = value; return this; }
    public IndexMetaData type(String value) { this.type = value; return this; }
    public IndexMetaData method(String value) { this.method = value; return this; }
    public IndexMetaData column(String value) { if (value != null && !value.isBlank()) columns.add(value); return this; }
}
