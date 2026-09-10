package cz.burios.qpx.darwin.db.uniql;

import java.math.*;
import java.time.*;
import java.util.LinkedHashMap;

public class BasicRecord extends LinkedHashMap<String,Object> {
    public void setString(String c,String v){put(c,v);} public String getString(String c){Object v=get(c);return v==null?null:v.toString();}
    public void setBigInteger(String c,BigInteger v){put(c,v);} public BigInteger getBigInteger(String c){Object v=get(c);return v instanceof BigInteger b?b:v==null?null:new BigInteger(v.toString());}
    public void setBigDecimal(String c,BigDecimal v){put(c,v);} public BigDecimal getBigDecimal(String c){Object v=get(c);return v instanceof BigDecimal b?b:v==null?null:new BigDecimal(v.toString());}
    public void setBoolean(String c,Boolean v){put(c,v);} public Boolean getBoolean(String c){Object v=get(c);return v instanceof Boolean b?b:v==null?null:Boolean.valueOf(v.toString());}
    public void setLocalDate(String c,LocalDate v){put(c,v);} public LocalDate getLocalDate(String c){return get(c) instanceof LocalDate v?v:null;}
    public void setLocalDateTime(String c,LocalDateTime v){put(c,v);} public LocalDateTime getLocalDateTime(String c){return get(c) instanceof LocalDateTime v?v:null;}
}
