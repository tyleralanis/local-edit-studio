export function createID(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
