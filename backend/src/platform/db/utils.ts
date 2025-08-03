import _ from "lodash";
import { Condition } from "./api";

export const getWhereClause = <Entity>(
  condition: Condition<Entity>,
  existingValuesCount = 0
) => {
  // Use lodash to remove any undeinfed values
  condition = _.omitBy(condition, _.isUndefined);
  const values: any[] = [];
  let whereClause = "";
  if ("where" in condition && "values" in condition) {
    // Protect query a bit (it should also be done before this point!)
    if (
      condition.where.includes(";") ||
      condition.where.includes("DROP") ||
      condition.where.includes("DELETE") ||
      condition.where.includes("UPDATE") ||
      condition.where.includes("INSERT")
    ) {
      throw new Error("Invalid query");
    }

    whereClause = `WHERE ${condition.where}`;
    values.push(...condition.values);
  } else {
    const conditionKeys = Object.keys(condition);
    if (conditionKeys.length) {
      const conditionPlaceholders = conditionKeys.map(
        (key, idx) =>
          `${key} = ${_.isArray(condition[key]) ? "ANY" : ""} ($${
            values.length + idx + 1 + existingValuesCount
          })`
      );
      whereClause = `WHERE ${conditionPlaceholders.join(" AND ")}`;
      values.push(...Object.values(condition));
    }
  }
  return { clause: whereClause, values };
};

export const sanitizeDocument = <Entity>(document: Entity) => {
  if (document && typeof document === "object") {
    Object.keys(document).forEach((k) => {
      if (typeof document[k] === "object") {
        document[k] = sanitizeDocument(document[k]);
      }
    });
  }

  return document;
};

export const sanitizeCondition = <Entity>(condition: Entity) => {
  return sanitizeDocument(condition);
};

// This generate pseudo unique ids, it should be enough as anyway data is segmented by client
// Also it would mean two objects are created at the same millisecond and share a 1 on 1 000 000 chance of collision
let localCounter = 0;
export const id = () =>
  (
    new Date().getTime() * 1000000 +
    (localCounter++ % 1000) * 1000 +
    Math.round(Math.random() * 1000)
  )
    .toString(36)
    .padStart(12, "0");

export const columnsFromEntity = (classEntity: any) => {
  const instance = new classEntity();
  const columns = {};
  for (const key of Object.keys(instance)) {
    const isArray = _.isArray(instance[key]);
    const baseType = isArray ? instance[key][0] : instance[key];
    if (typeof baseType === "string") {
      columns[key] = "VARCHAR(256)";
    } else if (_.isDate(baseType)) {
      columns[key] = "BIGINT";
    } else if (_.isBoolean(baseType)) {
      columns[key] = "BOOLEAN";
    } else if (_.isNumber(baseType)) {
      columns[key] = "FLOAT";
    } else {
      columns[key] = "JSONB";
    }
    if (isArray) {
      columns[key] = columns[key] + "[]";
    }
  }
  return columns;
};
