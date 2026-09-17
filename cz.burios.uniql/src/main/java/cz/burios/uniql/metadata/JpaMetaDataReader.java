package cz.burios.uniql.metadata;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.OffsetTime;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.UUID;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;

/** Reads portable database metadata declared by JPA entity annotations. */
public class JpaMetaDataReader {

    /** Reads all entity types known by the supplied persistence unit. */
    public DBMetaData read(EntityManagerFactory entityManagerFactory) {
        if (entityManagerFactory == null) throw new IllegalArgumentException("entityManagerFactory must not be null");
        DBMetaData result = new DBMetaData();
        Metamodel metamodel = entityManagerFactory.getMetamodel();
        for (EntityType<?> entity : metamodel.getEntities()) result.add(readTable(entity));
        return result;
    }

    /** Reads one JPA entity into the common table metadata model. */
    public TableMetaData readTable(EntityType<?> entity) {
        if (entity == null) throw new IllegalArgumentException("entity must not be null");
        Class<?> javaType = entity.getJavaType();
        Table tableAnnotation = findAnnotation(javaType, Table.class);
        String tableName = tableAnnotation != null && !tableAnnotation.name().isBlank() ? tableAnnotation.name() : entity.getName();
        TableMetaData table = new TableMetaData(tableName);
        if (tableAnnotation != null) {
            if (!tableAnnotation.catalog().isBlank()) table.database(tableAnnotation.catalog());
            if (!tableAnnotation.schema().isBlank()) table.schema(tableAnnotation.schema());
        }
        table.label(entity.getName());

        for (Attribute<?, ?> attribute : entity.getAttributes()) {
            if (attribute.getPersistentAttributeType() == Attribute.PersistentAttributeType.EMBEDDED
                    && annotation(findField(javaType, attribute.getName()), findGetter(javaType, attribute.getName()), EmbeddedId.class) != null) {
                readEmbeddedId(table, javaType, attribute.getJavaType(), attribute.getName());
                continue;
            }
            if (attribute.getPersistentAttributeType() != Attribute.PersistentAttributeType.BASIC) continue;
            ColumnMetaData column = readColumn(javaType, attribute);
            if (column != null) table.addColumn(column);
            if (column != null && column.unique) {
                IndexMetaData index = new IndexMetaData(tableName + "_uk_" + column.name);
                index.unique(true).column(column.name);
                table.addIndex(index);
            }
        }

        if (tableAnnotation != null) {
            for (jakarta.persistence.Index annotation : tableAnnotation.indexes()) {
                IndexMetaData index = new IndexMetaData(indexName(annotation.name(), tableName, annotation.columnList()));
                index.unique(annotation.unique());
                for (String column : annotation.columnList().split(",")) index.column(column.trim());
                table.addIndex(index);
            }
            for (UniqueConstraint annotation : tableAnnotation.uniqueConstraints()) {
                IndexMetaData index = new IndexMetaData(indexName(annotation.name(), tableName, String.join(",", annotation.columnNames())));
                index.unique(true);
                for (String column : annotation.columnNames()) index.column(column.trim());
                table.addIndex(index);
            }
        }
        return table;
    }

    private void readEmbeddedId(TableMetaData table, Class<?> entityType, Class<?> embeddedType, String embeddedAttributeName) {
        AttributeOverride[] overrides = attributeOverrides(entityType, embeddedAttributeName);
        for (Field field : allFields(embeddedType)) {
            if (java.lang.reflect.Modifier.isStatic(field.getModifiers())) continue;
            if (annotation(field, findGetter(embeddedType, field.getName()), Column.class) == null
                    && annotation(field, findGetter(embeddedType, field.getName()), Id.class) == null) {
                // An EmbeddedId member is still a column even without @Column; use its Java name.
            }
            Column override = findOverride(overrides, field.getName());
            ColumnMetaData column = readEmbeddedColumn(field, override);
            if (column != null) table.addColumn(column);
        }
    }

    private ColumnMetaData readEmbeddedColumn(Field field, Column override) {
        Method getter = findGetter(field.getDeclaringClass(), field.getName());
        Column annotation = annotation(field, getter, Column.class);
        String columnName = override != null && !override.name().isBlank()
                ? override.name()
                : annotation != null && !annotation.name().isBlank() ? annotation.name() : field.getName();
        ColumnMetaData column = new ColumnMetaData(columnName);
        column.label(field.getName());
        applyLogicalType(column, field.getType(), field, getter);
        Column effective = override != null ? override : annotation;
        if (effective != null) {
            column.nullable(effective.nullable());
            if (effective.length() > 0) column.length(effective.length());
            if (effective.precision() > 0) column.precision(effective.precision());
            if (effective.scale() > 0) column.scale(effective.scale());
            if (!effective.columnDefinition().isBlank()) column.type(effective.columnDefinition());
            column.unique = effective.unique();
        }
        column.primaryKey(true).nullable(false);
        return column;
    }

    private ColumnMetaData readColumn(Class<?> entityType, Attribute<?, ?> attribute) {
        String attributeName = attribute.getName();
        Field field = findField(entityType, attributeName);
        Method getter = findGetter(entityType, attributeName);
        Column annotation = annotation(field, getter, Column.class);
        String columnName = annotation != null && !annotation.name().isBlank() ? annotation.name() : attributeName;
        ColumnMetaData column = new ColumnMetaData(columnName);
        column.label(attributeName);
        applyLogicalType(column, attribute.getJavaType(), field, getter);
        if (annotation != null) {
            column.nullable(annotation.nullable());
            if (annotation.length() > 0) column.length(annotation.length());
            if (annotation.precision() > 0) column.precision(annotation.precision());
            if (annotation.scale() > 0) column.scale(annotation.scale());
            if (!annotation.columnDefinition().isBlank()) column.type(annotation.columnDefinition());
            column.unique = annotation.unique();
        }
        if (annotation(field, getter, Id.class) != null) column.primaryKey(true).nullable(false);
        GeneratedValue generated = annotation(field, getter, GeneratedValue.class);
        if (generated != null && generated.strategy() == GenerationType.IDENTITY) column.autoIncrement(true);
        return column;
    }

    private void applyLogicalType(ColumnMetaData column, Class<?> javaType, Field field, Method getter) {
        if (javaType == String.class || javaType == Character.class || javaType == char.class) column.logicalType(ColumnType.STRING);
        else if (javaType == boolean.class || javaType == Boolean.class) column.logicalType(ColumnType.BOOLEAN);
        else if (javaType == byte.class || javaType == Byte.class || javaType == short.class || javaType == Short.class || javaType == int.class || javaType == Integer.class) column.logicalType(ColumnType.INTEGER);
        else if (javaType == long.class || javaType == Long.class || javaType == BigInteger.class) column.logicalType(ColumnType.LONG);
        else if (javaType == float.class || javaType == Float.class || javaType == double.class || javaType == Double.class) column.logicalType(ColumnType.DOUBLE);
        else if (javaType == BigDecimal.class) column.logicalType(ColumnType.DECIMAL);
        else if (javaType == byte[].class) column.logicalType(ColumnType.BINARY);
        else if (javaType == LocalDate.class) column.logicalType(ColumnType.DATE);
        else if (javaType == LocalTime.class || javaType == OffsetTime.class) column.logicalType(ColumnType.TIME);
        else if (javaType == LocalDateTime.class) column.logicalType(ColumnType.DATETIME);
        else if (javaType == Instant.class || javaType == OffsetDateTime.class || javaType == ZonedDateTime.class) column.logicalType(ColumnType.TIMESTAMP);
        else if (javaType == Date.class) {
            Temporal temporal = annotation(field, getter, Temporal.class);
            if (temporal != null && temporal.value() == TemporalType.DATE) column.logicalType(ColumnType.DATE);
            else if (temporal != null && temporal.value() == TemporalType.TIME) column.logicalType(ColumnType.TIME);
            else column.logicalType(ColumnType.TIMESTAMP);
        } else if (javaType.isEnum()) {
            Enumerated enumerated = annotation(field, getter, Enumerated.class);
            column.logicalType(enumerated != null && enumerated.value() == EnumType.ORDINAL ? ColumnType.INTEGER : ColumnType.STRING);
        } else if (javaType == UUID.class) column.logicalType(ColumnType.STRING).length(36);
        else column.logicalType(null);
    }

    private static AttributeOverride[] attributeOverrides(Class<?> entityType, String attributeName) {
        AttributeOverrides overrides = entityType.getAnnotation(AttributeOverrides.class);
        if (overrides != null) return filterOverrides(overrides.value(), attributeName);
        AttributeOverride override = entityType.getAnnotation(AttributeOverride.class);
        if (override != null && override.name().startsWith(attributeName + ".")) return new AttributeOverride[] { override };
        return new AttributeOverride[0];
    }

    private static AttributeOverride[] filterOverrides(AttributeOverride[] overrides, String attributeName) {
        java.util.List<AttributeOverride> result = new java.util.ArrayList<>();
        String prefix = attributeName + ".";
        for (AttributeOverride override : overrides) if (override.name().startsWith(prefix)) result.add(override);
        return result.toArray(new AttributeOverride[0]);
    }

    private static Column findOverride(AttributeOverride[] overrides, String fieldName) {
        String suffix = "." + fieldName;
        for (AttributeOverride override : overrides) {
            if (override.name().equals(fieldName) || override.name().endsWith(suffix)) return override.column();
        }
        return null;
    }

    private static Field[] allFields(Class<?> type) {
        java.util.List<Field> result = new java.util.ArrayList<>();
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            for (Field field : current.getDeclaredFields()) result.add(field);
        }
        return result.toArray(new Field[0]);
    }

    private static String indexName(String explicitName, String tableName, String columns) {
        if (explicitName != null && !explicitName.isBlank()) return explicitName;
        String normalized = columns == null ? "" : columns.trim().replaceAll("\\s*,\\s*", "_");
        return tableName + "_uk_" + normalized;
    }

    private static <A extends java.lang.annotation.Annotation> A annotation(Field field, Method getter, Class<A> type) {
        A result = field == null ? null : field.getAnnotation(type);
        return result != null ? result : getter == null ? null : getter.getAnnotation(type);
    }

    private static <A extends java.lang.annotation.Annotation> A findAnnotation(Class<?> type, Class<A> annotationType) {
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            A annotation = current.getAnnotation(annotationType);
            if (annotation != null) return annotation;
        }
        return null;
    }

    private static Field findField(Class<?> type, String name) {
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            try { return current.getDeclaredField(name); } catch (NoSuchFieldException ignored) { }
        }
        return null;
    }

    private static Method findGetter(Class<?> type, String name) {
        String suffix = Character.toUpperCase(name.charAt(0)) + name.substring(1);
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            try { return current.getDeclaredMethod("get" + suffix); } catch (NoSuchMethodException ignored) { }
            try { return current.getDeclaredMethod("is" + suffix); } catch (NoSuchMethodException ignored) { }
        }
        return null;
    }
}
