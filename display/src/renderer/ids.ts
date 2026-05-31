export function getEntityId(entity: unknown): string | undefined {
  if (!entity || typeof entity !== 'object') {
    return undefined;
  }

  const record = entity as { id?: unknown; _id?: unknown };
  if (typeof record.id === 'string' && record.id.trim() !== '') {
    return record.id;
  }
  if (typeof record._id === 'string' && record._id.trim() !== '') {
    return record._id;
  }

  return undefined;
}
