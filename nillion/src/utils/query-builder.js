"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
class QueryBuilder {
    constructor() {
        this.pipeline = [];
    }
    match(conditions) {
        this.pipeline.push({ $match: conditions });
        return this;
    }
    group(groupSpec) {
        this.pipeline.push({ $group: groupSpec });
        return this;
    }
    sort(sortSpec) {
        this.pipeline.push({ $sort: sortSpec });
        return this;
    }
    limit(count) {
        this.pipeline.push({ $limit: count });
        return this;
    }
    project(projection) {
        this.pipeline.push({ $project: projection });
        return this;
    }
    unwind(path) {
        this.pipeline.push({ $unwind: path });
        return this;
    }
    lookup(from, localField, foreignField, as) {
        this.pipeline.push({
            $lookup: {
                from,
                localField,
                foreignField,
                as,
            },
        });
        return this;
    }
    addFields(fields) {
        this.pipeline.push({ $addFields: fields });
        return this;
    }
    facet(facets) {
        this.pipeline.push({ $facet: facets });
        return this;
    }
    build() {
        return [...this.pipeline];
    }
    buildWithVariables(variables) {
        return {
            pipeline: this.build(),
            variables,
        };
    }
    clear() {
        this.pipeline = [];
        return this;
    }
    // Common analytics patterns
    static countByField(fieldName) {
        return new QueryBuilder()
            .group({
            _id: `$${fieldName}`,
            count: { $sum: 1 },
        })
            .sort({ count: -1 });
    }
    static dateHistogram(dateField, interval = "day") {
        const dateGrouping = interval === "day"
            ? { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` } }
            : interval === "month"
                ? { $dateToString: { format: "%Y-%m", date: `$${dateField}` } }
                : { $dateToString: { format: "%Y", date: `$${dateField}` } };
        return new QueryBuilder()
            .group({
            _id: dateGrouping,
            count: { $sum: 1 },
        })
            .sort({ _id: 1 });
    }
    static topN(fieldName, n = 10) {
        return new QueryBuilder()
            .group({
            _id: `$${fieldName}`,
            count: { $sum: 1 },
        })
            .sort({ count: -1 })
            .limit(n);
    }
    static averageByGroup(groupField, valueField) {
        return new QueryBuilder()
            .group({
            _id: `$${groupField}`,
            average: { $avg: `$${valueField}` },
            count: { $sum: 1 },
        })
            .sort({ average: -1 });
    }
}
exports.QueryBuilder = QueryBuilder;
