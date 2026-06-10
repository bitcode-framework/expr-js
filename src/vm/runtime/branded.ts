// BrandedValue: runtime wrapper for Go named types (e.g., ModeEnum int).
// Carries a type name via Symbol so that runtime Equal can distinguish
// `ModeEnum(1) == int(1)` → false, mirroring Go's reflect.DeepEqual behavior
// where named types are distinct from their underlying primitive types.
export const BRANDED = Symbol.for("expr.branded");

export interface BrandedValue {
  readonly [BRANDED]: string;
  readonly _value: any;
}

export function brand(value: any, typeName: string): BrandedValue {
  return { [BRANDED]: typeName, _value: value };
}

export function getBrand(v: any): string | undefined {
  if (v !== null && typeof v === "object" && BRANDED in v) {
    return (v as BrandedValue)[BRANDED];
  }
  return undefined;
}

export function unbrand(v: any): any {
  if (v !== null && typeof v === "object" && BRANDED in v) {
    return (v as BrandedValue)._value;
  }
  return v;
}
