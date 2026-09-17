package cz.burios.qpx.darwin.db.uniql;

import cz.burios.qpx.darwin.db.model.BasicRecord;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Maps a JDBC row to BasicRecord or a BasicRecord descendant. */
public final class QLRowMapper {
    private QLRowMapper() {}

    public static <T extends BasicRecord> List<T> map(ResultSet rs, Class<T> type) throws SQLException {
        try {
            Constructor<T> constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            List<Field> fields = mappedFields(type);
            ResultSetMetaData meta = rs.getMetaData();
            List<T> result = new ArrayList<>();
            while (rs.next()) {
                T row = constructor.newInstance();
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    String label = meta.getColumnLabel(i);
                    Object value = rs.getObject(i);
                    row.put(label, value);
                    Field field = findField(fields, label);
                    if (field != null) field.set(row, convert(value, field.getType()));
                }
                result.add(row);
            }
            return result;
        } catch (ReflectiveOperationException e) {
            throw new SQLException("Cannot map ResultSet to " + type.getName(), e);
        }
    }

    private static List<Field> mappedFields(Class<?> type) {
        List<Field> fields = new ArrayList<>();
        for (Class<?> c = type; c != null && c != BasicRecord.class && c != Object.class; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                int modifiers = f.getModifiers();
                if (Modifier.isStatic(modifiers) || Modifier.isTransient(modifiers)) continue;
                if (hasAnnotation(f, "jakarta.persistence.Transient") || hasAnnotation(f, "javax.persistence.Transient")) continue;
                f.setAccessible(true);
                fields.add(f);
            }
        }
        return fields;
    }

    private static Field findField(List<Field> fields, String label) {
        for (Field f : fields) {
            String mapped = columnName(f);
            if (mapped.equalsIgnoreCase(label) || f.getName().equalsIgnoreCase(label)) return f;
        }
        return null;
    }

    private static String columnName(Field field) {
        String name = annotationValue(field, "jakarta.persistence.Column", "name");
        if (name == null) name = annotationValue(field, "javax.persistence.Column", "name");
        return name == null || name.isBlank() ? field.getName() : name;
    }

    private static boolean hasAnnotation(Field field, String className) {
        for (var annotation : field.getAnnotations()) if (annotation.annotationType().getName().equals(className)) return true;
        return false;
    }

    private static String annotationValue(Field field, String annotationClass, String member) {
        for (var annotation : field.getAnnotations()) {
            if (!annotation.annotationType().getName().equals(annotationClass)) continue;
            try { return String.valueOf(annotation.annotationType().getMethod(member).invoke(annotation)); }
            catch (ReflectiveOperationException ignored) { return null; }
        }
        return null;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object convert(Object value, Class<?> target) {
        if (value == null) return target.isPrimitive() ? primitiveDefault(target) : null;
        if (target.isInstance(value)) return value;
        if (target == String.class) return value.toString();
        if (target == BigDecimal.class) return value instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : new BigDecimal(value.toString());
        if (target == BigInteger.class) return value instanceof BigInteger ? value : new BigInteger(value.toString());
        if (target == Boolean.class || target == boolean.class) return value instanceof Number n ? n.intValue() != 0 : Boolean.valueOf(value.toString());
        if (target == Integer.class || target == int.class) return ((Number) value).intValue();
        if (target == Long.class || target == long.class) return ((Number) value).longValue();
        if (target == Short.class || target == short.class) return ((Number) value).shortValue();
        if (target == Byte.class || target == byte.class) return ((Number) value).byteValue();
        if (target == Double.class || target == double.class) return ((Number) value).doubleValue();
        if (target == Float.class || target == float.class) return ((Number) value).floatValue();
        if (target == LocalDate.class) return value instanceof Date d ? d.toLocalDate() : LocalDate.parse(value.toString());
        if (target == LocalDateTime.class) return value instanceof Timestamp t ? t.toLocalDateTime() : LocalDateTime.parse(value.toString().replace(' ', 'T'));
        if (target == UUID.class) return UUID.fromString(value.toString());
        if (target.isEnum()) return Enum.valueOf((Class<Enum>) target, value.toString().toUpperCase(Locale.ROOT));
        return value;
    }

    private static Object primitiveDefault(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == char.class) return '\0';
        if (type == byte.class) return (byte) 0;
        if (type == short.class) return (short) 0;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == float.class) return 0f;
        if (type == double.class) return 0d;
        return null;
    }
}
