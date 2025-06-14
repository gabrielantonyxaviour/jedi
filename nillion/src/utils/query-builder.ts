export class QueryBuilder {
  private pipeline: any[] = [];

  match(conditions: Record<string, any>): QueryBuilder {
    this.pipeline.push({ $match: conditions });
    return this;
  }

  group(groupSpec: Record<string, any>): QueryBuilder {
    this.pipeline.push({ $group: groupSpec });
    return this;
  }

  sort(sortSpec: Record<string, any>): QueryBuilder {
    this.pipeline.push({ $sort: sortSpec });
    return this;
  }

  limit(count: number): QueryBuilder {
    this.pipeline.push({ $limit: count });
    return this;
  }

  project(projection: Record<string, any>): QueryBuilder {
    this.pipeline.push({ $project: projection });
    return this;
  }

  unwind(path: string): QueryBuilder {
    this.pipeline.push({ $unwind: path });
    return this;
  }

  lookup(
    from: string,
    localField: string,
    foreignField: string,
    as: string
  ): QueryBuilder {
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

  addFields(fields: Record<string, any>): QueryBuilder {
    this.pipeline.push({ $addFields: fields });
    return this;
  }

  facet(facets: Record<string, any[]>): QueryBuilder {
    this.pipeline.push({ $facet: facets });
    return this;
  }

  build(): any[] {
    return [...this.pipeline];
  }

  buildWithVariables(variables: Record<string, any>): {
    pipeline: any[];
    variables: Record<string, any>;
  } {
    return {
      pipeline: this.build(),
      variables,
    };
  }

  clear(): QueryBuilder {
    this.pipeline = [];
    return this;
  }

  // Common analytics patterns
  static countByField(fieldName: string): QueryBuilder {
    return new QueryBuilder()
      .group({
        _id: `$${fieldName}`,
        count: { $sum: 1 },
      })
      .sort({ count: -1 });
  }

  static dateHistogram(
    dateField: string,
    interval: string = "day"
  ): QueryBuilder {
    const dateGrouping =
      interval === "day"
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

  static topN(fieldName: string, n: number = 10): QueryBuilder {
    return new QueryBuilder()
      .group({
        _id: `$${fieldName}`,
        count: { $sum: 1 },
      })
      .sort({ count: -1 })
      .limit(n);
  }

  static averageByGroup(groupField: string, valueField: string): QueryBuilder {
    return new QueryBuilder()
      .group({
        _id: `$${groupField}`,
        average: { $avg: `$${valueField}` },
        count: { $sum: 1 },
      })
      .sort({ average: -1 });
  }
}
