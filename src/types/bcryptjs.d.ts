declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: number | string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number, minor?: string): Promise<string>;
  export function hashSync(data: string, saltOrRounds: number | string): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSaltSync(rounds?: number, minor?: string): string;
}
