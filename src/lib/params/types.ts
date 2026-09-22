// src/lib/params/types.ts

// The kinds of clips that can exist on the timeline
export type ClipKind = 'video' | 'image' | 'text' | 'sticker' | 'audio' | 'transition' | 'adjustmentLayer' | 'template' | 'shape' | 'effect';

// Logical grouping for parameters in the UI
export type ParamGroupId = 
  | 'transform' 
  | 'animation' 
  | 'colorBasic' 
  | 'colorAdvanced' 
  | 'hsl' 
  | 'curves' 
  | 'colorWheels' 
  | 'lut' 
  | 'source'
  | 'speed' 
  | 'mask' 
  | 'audio' 
  | 'text' 
  | 'textAnim'
  | 'effects'
  | 'project';

export type ParamId = string;

// The actual value a parameter can hold
export type ParamValue = number | string | boolean | Record<string, unknown>;

// Base interface for all parameter definitions
export interface ParamBase {
  id: ParamId;
  group: ParamGroupId;
  label: string;
  appliesTo: ClipKind[];
  keyframe: boolean;
  defaultValue: ParamValue;
}

export interface ParamNumber extends ParamBase {
  kind: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
  clamp: 'hard' | 'soft';
  defaultValue: number;
  ui: {
    control: 'slider+input' | 'input';
    precision?: number;
  };
}

export interface ParamEnum extends ParamBase {
  kind: 'enum';
  options: { label: string; value: string | number }[];
  defaultValue: string | number;
  ui: {
    control: 'select' | 'radio-group';
  };
}

export interface ParamCompound extends ParamBase {
  kind: 'compound';
  schema: string; // e.g., 'hsl', 'curve', 'wheels'
  serialize: 'json';
  interpolation?: 'hold' | 'linear' | 'custom';
  defaultValue: Record<string, unknown>;
  ui: {
    control: 'custom'; // e.g. custom React component
  };
}

export interface ParamBoolean extends ParamBase {
  kind: 'boolean';
  defaultValue: boolean;
  ui: {
    control: 'switch' | 'checkbox';
  };
}

export type ParamDef = ParamNumber | ParamEnum | ParamCompound | ParamBoolean;
